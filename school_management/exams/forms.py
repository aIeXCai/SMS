from django import forms
from django.forms import formset_factory, BaseFormSet
from .models import Exam, ExamSubject, ACADEMIC_YEAR_CHOICES, SUBJECT_CHOICES, SUBJECT_DEFAULT_MAX_SCORES, Score
from school_management.students.models import Student, Class, GRADE_LEVEL_CHOICES, CLASS_NAME_CHOICES # 確保導入年級選項


class ExamSubjectForm(forms.Form):
    """
    考试科目配置表单，用于设置每个科目的满分
    """
    subject_code = forms.ChoiceField(
        choices=SUBJECT_CHOICES,
        label="科目",
        required=True,
        widget=forms.Select(attrs={'class': 'form-control subject-select'})
    )
    max_score = forms.IntegerField(
        min_value=1,
        max_value=999,
        label="满分",
        required=True,
        widget=forms.NumberInput(attrs={
            'step': '1',
            'min': '1',
            'max': '999',
            'class': 'form-control'
        })
    )

    
    def __init__(self, *args, **kwargs):
        grade_level = kwargs.pop('grade_level', None)
        super().__init__(*args, **kwargs)
        
        # 如果提供了年级，设置默认满分
        if grade_level and not self.is_bound:
            subject_code = self.initial.get('subject_code')
            if subject_code:
                default_config = SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})
                default_max_score = default_config.get(subject_code, 100)
                self.fields['max_score'].initial = default_max_score

class BaseExamSubjectFormSet(BaseFormSet):
    """
    考试科目表单集的基类，提供额外的验证和处理逻辑
    """
    def __init__(self, *args, **kwargs):
        self.grade_level = kwargs.pop('grade_level', None)
        super().__init__(*args, **kwargs)
    
    def get_form_kwargs(self, index):
        kwargs = super().get_form_kwargs(index)
        if self.grade_level:
            kwargs['grade_level'] = self.grade_level
        return kwargs
    
    def clean(self):
        """
        验证表单集，确保没有重复的科目
        """
        if any(self.errors):
            return
        
        subjects = []
        valid_forms_count = 0
        
        for i, form in enumerate(self.forms):
            # 检查表单是否有效且有数据
            if (hasattr(form, 'cleaned_data') and 
                form.cleaned_data and 
                not form.cleaned_data.get('DELETE', False)):
                
                subject_code = form.cleaned_data.get('subject_code')
                
                if subject_code:
                    valid_forms_count += 1
                    if subject_code in subjects:
                        # 提供更详细的错误信息
                        first_occurrence = subjects.index(subject_code) + 1
                        raise forms.ValidationError(
                            f"存在重复的科目：{subject_code}，请检查配置！"
                            f"该科目在第 {first_occurrence} 个和第 {i+1} 个表单中重复出现。"
                        )
                    subjects.append(subject_code)
        
        if not subjects:
            raise forms.ValidationError("至少需要配置一个科目")
        


# 创建考试科目表单集
ExamSubjectFormSet = formset_factory(
    ExamSubjectForm,
    formset=BaseExamSubjectFormSet,
    extra=0,  # 不显示空表单，避免与JavaScript动态添加的默认科目重复
    can_delete=False,  # 前端直接删除，不使用Django的DELETE机制
    min_num=0,  # 修改为0，避免自动生成额外表单
    validate_min=False,  # 在clean方法中手动验证
    max_num=20  # 设置最大表单数量限制
)

class ExamCreateForm(forms.ModelForm):
    """
    考试创建表单，用于第一步的基本信息录入
    """
    grade_level = forms.ChoiceField(
        choices=[('', '--- 选择年级 ---')] + GRADE_LEVEL_CHOICES,
        label="适用年级",
        required=True,
        widget=forms.Select(attrs={'class': 'form-control', 'id': 'id_grade_level'})
    )

    academic_year = forms.ChoiceField(
        choices=[('', '--- 选择学年 ---')] + ACADEMIC_YEAR_CHOICES,
        label="学年",
        required=True,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    class Meta:
        model = Exam
        fields = ['name', 'academic_year', 'date', 'grade_level', 'description']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'date': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }
        labels = {
            'name': '考试名称',
            'academic_year': '学年',
            'date': '考试日期',
            'grade_level': '适用年级',
            'description': '考试描述',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            if self.instance.date:
                self.initial['date'] = self.instance.date.strftime('%Y-%m-%d')
    
    def clean(self):
        cleaned_data = super().clean()
        name = cleaned_data.get('name')
        academic_year = cleaned_data.get('academic_year')
        grade_level = cleaned_data.get('grade_level')
        
        if name and academic_year and grade_level:
            # 检查是否存在相同学年、考试名称和年级的考试
            existing_exam = Exam.objects.filter(
                academic_year=academic_year,
                name=name,
                grade_level=grade_level
            )
            
            # 如果是编辑模式，排除当前正在编辑的考试
            if self.instance and self.instance.pk:
                existing_exam = existing_exam.exclude(pk=self.instance.pk)
            
            if existing_exam.exists():
                raise forms.ValidationError(
                    f"学年 {academic_year} 的 {grade_level} 中已存在名为 '{name}' 的考试，请使用不同的考试名称。"
                )
        
        return cleaned_data
    
    def get_default_subjects_for_grade(self, grade_level):
        """
        获取指定年级的默认科目配置
        """
        default_config = SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})
        subjects_data = []
        
        for i, (subject_code, max_score) in enumerate(default_config.items()):
            subjects_data.append({
                'subject_code': subject_code,
                'max_score': max_score,
                'order': i
            })
        
        return subjects_data

# 单条成绩录入/编辑
class ScoreForm(forms.ModelForm):
    # 下拉選單選擇學生，可以考慮使用 ModelChoiceField 以提供更好的選擇體驗
    student = forms.ModelChoiceField(
        queryset=Student.objects.all().order_by('name', 'student_id'), # 讓學生按姓名或學號排序
        label="學生",
        empty_label="--- 選擇學生 ---", # 空白選項
        required=True
    )
    
    # 下拉選單選擇考試
    exam = forms.ModelChoiceField(
        # 顯示更友好的考試名稱，例如 "2025-2026學年 期中考試 (初一)"
        queryset=Exam.objects.all().order_by('-academic_year', '-date', 'name'), # 讓考試按學年、日期排序
        label="考試",
        empty_label="--- 選擇考試 ---",
        required=True
    )

    # 科目選擇，使用之前定義的 SUBJECT_CHOICES
    subject = forms.ChoiceField(
        choices=[('', '--- 選擇科目 ---')] + SUBJECT_CHOICES,
        label="科目",
        required=True
    )

    class Meta:
        model = Score
        fields = ['student', 'exam', 'subject', 'score_value']
        labels = {
            'student': '學生',
            'exam': '考試',
            'subject': '科目',
            'score_value': '分數',
        }
        # 可以添加 widgets 或 validators，例如確保分數在合理範圍內
        widgets = {
            'score_value': forms.NumberInput(attrs={'step': '0.01', 'min': '0', 'max': '1000'})
        }

    # 確保在編輯時，如果學生、考試或科目有值，能正確預填充
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 如果是編輯模式 (有 instance)
        if self.instance and self.instance.pk:
            # 預填充 ModelChoiceField 的 initial 值
            if self.instance.student:
                self.initial['student'] = self.instance.student.pk
            if self.instance.exam:
                self.initial['exam'] = self.instance.exam.pk
            if self.instance.subject:
                self.initial['subject'] = self.instance.subject # CharField 直接賦值
            if self.instance.score_value is not None:
                self.initial['score_value'] = self.instance.score_value

# 批量成績導入
class ScoreBatchUploadForm(forms.Form):
    excel_file = forms.FileField(label="选择成绩Excel文件", help_text="请上传包含学生学号、科目和成绩的Excel文件。")
    
    # 為了方便與特定的考試關聯，可以讓用戶在提交時選擇這是哪場考試的成績
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all().order_by('-academic_year', '-date', 'name'),
        label="选择对应的考试",
        empty_label="--- 请选择考试 ---",
        required=True
    )

    def clean_excel_file(self):
        excel_file = self.cleaned_data['excel_file']
        # 簡單的文件類型驗證
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            raise forms.ValidationError("不支持的文件类型。请上传 .xlsx 或 .xls 文件。")
        return excel_file

# 成绩查询表单
class ScoreQueryForm(forms.Form):
    # 学生信息筛选
    student_name = forms.CharField(
        max_length=50,
        required=False,
        label="学生姓名",
        widget=forms.TextInput(attrs={'placeholder': '支持模糊搜索'})
    )
    
    student_id = forms.CharField(
        max_length=20,
        required=False,
        label="学号",
        widget=forms.TextInput(attrs={'placeholder': '支持模糊搜索'})
    )
    
    # 班级信息筛选
    grade_level = forms.ChoiceField(
        choices=[('', '--- 所有年级 ---')] + GRADE_LEVEL_CHOICES,
        required=False,
        label="年级"
    )
    
    class_name = forms.ChoiceField(
        choices=[('', '--- 所有班级 ---')] + CLASS_NAME_CHOICES,
        required=False,
        label="班级"
    )
    
    # 考试信息筛选
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all().order_by('-academic_year', '-date', 'name'),
        required=False,
        label="考试",
        empty_label="--- 所有考试 ---"
    )
    
    academic_year = forms.ChoiceField(
        choices=[('', '--- 所有学年 ---')] + ACADEMIC_YEAR_CHOICES,
        required=False,
        label="学年"
    )
    
    # 科目筛选
    subject = forms.ChoiceField(
        choices=[('', '--- 所有科目 ---')] + SUBJECT_CHOICES,
        required=False,
        label="科目"
    )
    
    # 日期范围筛选
    date_from = forms.DateField(
        required=False,
        label="考试开始日期",
        widget=forms.DateInput(attrs={'type': 'date'})
    )
    
    date_to = forms.DateField(
        required=False,
        label="考试结束日期",
        widget=forms.DateInput(attrs={'type': 'date'})
    )
    
    # 排序选项
    SORT_CHOICES = [
        ('', '--- 默认排序 ---'),
        ('total_score_desc', '总分降序'),
        ('total_score_asc', '总分升序'),
        ('student_name', '学生姓名'),
        ('exam_date', '考试日期'),
        ('grade_rank', '年级排名'),
    ]
    
    sort_by = forms.ChoiceField(
        choices=SORT_CHOICES,
        required=False,
        label="排序方式"
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 动态更新班级选择（可以通过Ajax实现年级联动）
        # 这里先保持简单实现
        pass

# 成绩添加表单
class ScoreAddForm(forms.Form):
    student = forms.CharField(
        label="学生",
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '输入学生姓名、学号或班级进行搜索...',
            'id': 'student-search'
        })
    )
    
    student_id = forms.CharField(
        widget=forms.HiddenInput(),
        required=True
    )
    
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all().order_by('-academic_year', '-date', 'name'),
        label="考试",
        empty_label="--- 选择考试 ---",
        required=True
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 为每个科目动态添加字段
        for subject_code, subject_name in SUBJECT_CHOICES:
            self.fields[f'score_{subject_code}'] = forms.DecimalField(
                max_digits=5,
                decimal_places=2,
                required=False,
                label=subject_name,
                widget=forms.NumberInput(attrs={
                    'step': '0.01',
                    'min': '0',
                    'max': '150',
                    'placeholder': '请输入分数'
                })
            )
    
    def clean(self):
        cleaned_data = super().clean()
        student_id = cleaned_data.get('student_id')
        exam = cleaned_data.get('exam')
        
        # 验证学生ID并获取学生对象
        student = None
        if student_id:
            try:
                student = Student.objects.get(id=student_id)
                cleaned_data['student'] = student
            except Student.DoesNotExist:
                raise forms.ValidationError("选择的学生不存在，请重新选择。")
        
        # 检查是否至少输入了一个科目成绩
        has_score = False
        for subject_code, _ in SUBJECT_CHOICES:
            score_field = f'score_{subject_code}'
            if cleaned_data.get(score_field) is not None:
                has_score = True
                break
        
        if not has_score:
            raise forms.ValidationError("请至少输入一个科目的成绩。")
        
        # 检查是否已存在成绩记录
        if student and exam:
            existing_subjects = []
            for subject_code, subject_name in SUBJECT_CHOICES:
                score_field = f'score_{subject_code}'
                if cleaned_data.get(score_field) is not None:
                    existing = Score.objects.filter(
                        student=student,
                        exam=exam,
                        subject=subject_code
                    ).exists()
                    if existing:
                        existing_subjects.append(subject_name)
            
            if existing_subjects:
                raise forms.ValidationError(
                    f"以下科目的成绩已存在：{', '.join(existing_subjects)}。请检查后重新输入。"
                )
        
        return cleaned_data

# 成绩分析筛选表单
class ScoreAnalysisForm(forms.Form):
    academic_year = forms.ChoiceField(
        choices=[('', '--- 选择学年 ---')] + ACADEMIC_YEAR_CHOICES,
        required=True,
        label="学年"
    )
    
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all().order_by('-academic_year', '-date', 'name'),
        required=True,
        label="考试",
        empty_label="--- 选择考试 ---"
    )
    
    grade_level = forms.ChoiceField(
        choices=[('', '--- 选择年级 ---')] + GRADE_LEVEL_CHOICES,
        required=True,
        label="年级"
    )
    
    # 班级多选字段
    selected_classes = forms.ModelMultipleChoiceField(
        queryset=Class.objects.none(),  # 初始为空，通过JavaScript动态加载
        required=False,
        label="选择班级",
        widget=forms.CheckboxSelectMultiple(),
        help_text="选择一个班级进行详细分析，选择多个班级进行对比分析"
    )
    
    # 使用隐藏字段存储选择的班级（保持兼容性）
    class_name = forms.CharField(
        required=False,
        widget=forms.HiddenInput(),
        label="班级"
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 动态过滤考试选项，只显示有成绩数据的考试
        self.fields['exam'].queryset = Exam.objects.filter(
            score__isnull=False
        ).distinct().order_by('-academic_year', '-date', 'name')
        
        # 如果有年级参数，动态加载对应的班级
        grade_level = self.data.get('grade_level') or self.initial.get('grade_level')
        if grade_level:
            self.fields['selected_classes'].queryset = Class.objects.filter(
                grade_level=grade_level
            ).order_by('class_name')
        else:
            self.fields['selected_classes'].queryset = Class.objects.none()
    
    def clean(self):
        cleaned_data = super().clean()
        grade_level = cleaned_data.get('grade_level')
        class_selection = self.data.get('class_selection')
        selected_classes = cleaned_data.get('selected_classes')
        
        # 验证班级选择
        if class_selection == 'all':
            # 选择所有班级，清空具体班级选择
            cleaned_data['selected_classes'] = Class.objects.none()
        elif not selected_classes:
            raise forms.ValidationError("请选择至少一个班级进行分析。")
        
        # 验证选择的班级是否属于指定年级
        if selected_classes and grade_level:
            invalid_classes = selected_classes.exclude(grade_level=grade_level)
            if invalid_classes.exists():
                raise forms.ValidationError(
                    f"选择的班级中有不属于{grade_level}的班级。"
                )
        
        # 限制班级数量
        if selected_classes and selected_classes.count() > 6:
            raise forms.ValidationError("最多只能选择6个班级进行对比分析。")
        
        return cleaned_data































from django import forms
from django.forms import formset_factory, modelformset_factory, BaseFormSet
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from .models import (
    Exam, ExamSubject, Score, Student, Class,
    GRADE_LEVEL_CHOICES, SUBJECT_CHOICES, SUBJECT_DEFAULT_MAX_SCORES,
    ACADEMIC_YEAR_CHOICES, STATUS_CHOICES, CLASS_NAME_CHOICES
)

# =============================================================================
# 考试管理相关表单
# =============================================================================

# 考试科目配置表单，用于设置每个科目的满分
class ExamSubjectForm(forms.Form):
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

# 考试科目表单集的基类，提供额外的验证和处理逻辑
class BaseExamSubjectFormSet(BaseFormSet):
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
    formset=BaseExamSubjectFormSet,  # 使用自定义的表单集基类
    extra=0,  # 不显示额外的空表单
    can_delete=True, # 允许删除科目
    min_num=1,  # 至少需要一个科目
    validate_min=False, # 在clean方法中手动验证
    max_num=len(SUBJECT_CHOICES),  # 最多允许所有科目
)

# 考试创建表单——第一步：基本信息录入
class ExamCreateForm(forms.ModelForm):
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


# =============================================================================
# 成绩管理相关表单
# =============================================================================

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


# =============================================================================
# 查询和分析相关表单
# =============================================================================

# 成绩查询表单
class ScoreQueryForm(forms.Form):
    # 学生信息筛选
    student_name = forms.CharField(
        max_length=50,
        required=False,
        label="学生姓名",
        widget=forms.TextInput(attrs={'placeholder': '支持模糊搜索', 'class': 'form-control'})
    )
    
    student_id = forms.CharField(
        max_length=20,
        required=False,
        label="学号",
        widget=forms.TextInput(attrs={'placeholder': '支持模糊搜索', 'class': 'form-control'})
    )
    
    # 班级信息筛选
    grade_level = forms.ChoiceField(
        choices=[('', '--- 所有年级 ---')] + GRADE_LEVEL_CHOICES,
        required=False,
        label="年级",
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    class_name = forms.ChoiceField(
        choices=[('', '--- 所有班级 ---')] + CLASS_NAME_CHOICES,
        required=False,
        label="班级",
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    # 考试信息筛选
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all().order_by('-academic_year', '-date', 'name'),
        required=False,
        label="考试",
        empty_label="--- 所有考试 ---",
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    academic_year = forms.ChoiceField(
        choices=[('', '--- 所有学年 ---')] + ACADEMIC_YEAR_CHOICES,
        required=False,
        label="学年",
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    # 科目筛选 - 改为多选
    subject = forms.MultipleChoiceField(
        choices=SUBJECT_CHOICES,
        required=False,
        label="科目",
        widget=forms.MultipleHiddenInput(),
        help_text="可选择多个科目进行查询"
    )
    
    # 日期范围筛选
    date_from = forms.DateField(
        required=False,
        label="考试开始日期",
        widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-control'})
    )
    
    date_to = forms.DateField(
        required=False,
        label="考试结束日期",
        widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-control'})
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
        label="排序方式",
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 动态更新班级选择（可以通过Ajax实现年级联动）
        # 这里先保持简单实现
        pass


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
        
        # 限制班级数量（可选择更多班级进行对比分析）
        if selected_classes and selected_classes.count() > 20:
            raise forms.ValidationError("最多只能选择20个班级进行对比分析。")
        
        return cleaned_data


    """成绩批量上传表单"""
    
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all(),
        label='选择考试',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    file = forms.FileField(
        label='选择Excel文件',
        widget=forms.FileInput(attrs={
            'class': 'form-control',
            'accept': '.xlsx,.xls'
        }),
        help_text='支持.xlsx和.xls格式，文件大小不超过10MB'
    )
    overwrite = forms.BooleanField(
        required=False,
        label='覆盖已存在的成绩',
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
    )

    def clean_file(self):
        file = self.cleaned_data.get('file')
        if file:
            if file.size > 10 * 1024 * 1024:  # 10MB
                raise ValidationError('文件大小不能超过10MB')
            
            if not file.name.endswith(('.xlsx', '.xls')):
                raise ValidationError('只支持Excel文件格式(.xlsx, .xls)')
        
        return file



    """成绩分析表单"""
    
    ANALYSIS_TYPE_CHOICES = [
        ('class', '班级分析'),
        ('grade', '年级分析'),
        ('student', '学生个人分析'),
        ('subject', '科目分析'),
    ]
    
    analysis_type = forms.ChoiceField(
        choices=ANALYSIS_TYPE_CHOICES,
        label='分析类型',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    exam = forms.ModelChoiceField(
        queryset=Exam.objects.all(),
        label='选择考试',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    grade_level = forms.ChoiceField(
        choices=GRADE_LEVEL_CHOICES,
        label='年级',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    class_filter = forms.ModelChoiceField(
        queryset=Class.objects.none(),
        required=False,
        label='班级',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    student = forms.ModelChoiceField(
        queryset=Student.objects.none(),
        required=False,
        label='学生',
        widget=forms.Select(attrs={'class': 'form-control'})
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 根据年级动态加载班级和学生
        if 'grade_level' in self.data:
            try:
                grade_level = self.data.get('grade_level')
                if grade_level:
                    self.fields['class_filter'].queryset = Class.objects.filter(
                        grade_level=grade_level
                    )
                    self.fields['student'].queryset = Student.objects.filter(
                        grade_level=grade_level
                    )
            except (ValueError, TypeError):
                pass

# =============================================================================
# 学生管理相关表单
# =============================================================================

# 学生信息表单
class StudentForm(forms.ModelForm):
    """学生信息表单"""
    grade_level = forms.ChoiceField(
        choices=[('', '--- 选择年级 ---')] + GRADE_LEVEL_CHOICES,
        label="年级",
        required=True
    )
    class_name = forms.ChoiceField(
        choices=[('', '--- 选择班级 ---')] + CLASS_NAME_CHOICES,
        label="班级名称",
        required=True
    )

    class Meta:
        model = Student
        fields = [
            'student_id', 'name', 'gender', 'date_of_birth',
            'grade_level', 'current_class', 'status',
            'id_card_number', 'student_enrollment_number',
            'home_address', 'guardian_name', 'guardian_contact_phone',
            'entry_date', 'graduation_date'
        ]
        widgets = {
            'date_of_birth': forms.DateInput(attrs={'type': 'date'}),
            'entry_date': forms.DateInput(attrs={'type': 'date'}),
            'graduation_date': forms.DateInput(attrs={'type': 'date'}),
        }
        labels = {
            'student_id': '学号', 'name': '姓名', 'gender': '性别',
            'date_of_birth': '出生日期', 'status': '在校状态',
            'id_card_number': '身份证号码', 'student_enrollment_number': '学籍号',
            'home_address': '家庭地址', 'guardian_name': '监护人姓名',
            'guardian_contact_phone': '监护人联系电话',
            'entry_date': '入学日期', 'graduation_date': '毕业日期'
        }

     # 重寫 __init__ 方法，以便在編輯時初始化 grade_level 和 class_name
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 如果是编辑现有学生
        if self.instance and self.instance.pk:
            # 初始化年級和班級
            if self.instance.current_class:
                self.fields['grade_level'].initial = self.instance.current_class.grade_level
                self.fields['class_name'].initial = self.instance.current_class.class_name
        
        date_fields = ['date_of_birth', 'entry_date', 'graduation_date']
        for field_name in date_fields:
            field_value = getattr(self.instance, field_name)
            if field_value:
                # 如果字段有值，将其格式化为 'YYYY-MM-DD' 字符串
                self.initial[field_name] = field_value.strftime('%Y-%m-%d')
            else:
                # 如果字段没有值，确保初始值是 None 或空字符串，避免显示 'None'
                self.initial[field_name] = ''

    # 重寫 save 方法，以便處理 current_class 的關聯邏輯
    def save(self, commit=True):
        student = super().save(commit=False)
        
        grade_level = self.cleaned_data.get('grade_level')
        class_name = self.cleaned_data.get('class_name')

        if grade_level and class_name:
            # 查找或創建對應的 Class 物件
            # get_or_create 會返回 (object, created)
            current_class, created = Class.objects.get_or_create(
                grade_level=grade_level,
                class_name=class_name
            )
            student.current_class = current_class
        else:
            student.current_class = None # 如果沒有選擇年級班級，則設置為 None

        if commit:
            student.save()
        return student

# Excel上傳表單
class ExcelUploadForm(forms.Form):
    excel_file = forms.FileField(label="选择 Excel 文件")

# 批量修改狀態表單
class BatchUpdateStatusForm(forms.Form):
    status = forms.ChoiceField(
        choices=STATUS_CHOICES,
        label="选择新的状态"
    )

# 批量升年級表單
class BatchPromoteGradeForm(forms.Form):
    # 從哪個年級升級 (可以是空，表示不篩選)
    current_grade_level = forms.ChoiceField(
        choices=[('', '当前年级')] + GRADE_LEVEL_CHOICES,
        required=False,
        label="当前年级"
    )
    
    # 升級到哪個年級（這是新的年級）
    # 這裡我們需要定義年級的順序，以便知道下一個年級是什麼
    PROMOTION_GRADE_CHOICES = [
        ('高一', '高一'),
        ('高二', '高二'),
        ('高三', '高三'),
        ('初一', '初一'),
        ('初二', '初二'),
        ('初三', '初三'),
        # 可以根據學校實際年級設置來擴展
    ]
    
    target_grade_level = forms.ChoiceField(
        choices=[('', '--- 选择目标年级 ---')] + PROMOTION_GRADE_CHOICES,
        required=True,
        label="目标年级"
    )

    # 是否自動創建班級，如果目標年級的班級不存在
    auto_create_classes = forms.BooleanField(
        label="如果目标班级不存在则自动创建",
        required=False,
        initial=True # 默認為自動創建
    )

# 學生搜索表單
class StudentSearchForm(forms.Form):
    """学生搜索表单"""
    
    search_query = forms.CharField(
        required=False,
        label='搜索',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '输入学号、姓名进行搜索'
        })
    )
    grade_level = forms.ChoiceField(
        choices=[('', '全部年级')] + list(GRADE_LEVEL_CHOICES),
        required=False,
        label='年级',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    current_class = forms.ModelChoiceField(
        queryset=Class.objects.all(),
        required=False,
        label='班级',
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    status = forms.ChoiceField(
        choices=[('', '全部状态')] + list(STATUS_CHOICES),
        required=False,
        label='状态',
        widget=forms.Select(attrs={'class': 'form-control'})
    )

# =============================================================================
# 班级管理相关表单
# =============================================================================

# 班级信息表单
class ClassForm(forms.ModelForm):
    """班级信息表单"""
    
    class Meta:
        model = Class
        fields = ['grade_level', 'class_name', 'homeroom_teacher']
        widgets = {
            'grade_level': forms.Select(attrs={'class': 'form-control'}),
            'class_name': forms.TextInput(attrs={'class': 'form-control'}),
            'homeroom_teacher': forms.Select(attrs={'class': 'form-control'}),
        }
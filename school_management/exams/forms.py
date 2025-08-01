from django import forms
from .models import Exam, ACADEMIC_YEAR_CHOICES, SUBJECT_CHOICES, Score
from school_management.students.models import Student, Class, GRADE_LEVEL_CHOICES, CLASS_NAME_CHOICES # 確保導入年級選項

class ExamForm(forms.ModelForm):
    # 如果你希望年級選擇像學生表單那樣有 '-- 選擇年級 --' 的預設選項
    grade_level = forms.ChoiceField(
        choices=[('', '--- 选择年级 ---')] + GRADE_LEVEL_CHOICES,
        label="适用年级",
        required=True
    )

    academic_year = forms.ChoiceField(
        choices=[('', '--- 选择学年 ---')] + ACADEMIC_YEAR_CHOICES, # 使用新的學年選項
        label="学年",
        required=True
    )

    class Meta:
        model = Exam
        fields = ['name', 'academic_year', 'date', 'grade_level', 'description']
        widgets = {
            'date': forms.DateInput(attrs={'type': 'date'}), # 使用 HTML5 date input
        }
        labels = {
            'name': '考試名稱',
            'academic_year': '學年',
            'date': '考試日期',
            'grade_level': '適用年級',
            'description': '考試描述',
        }

    # 確保日期在編輯時能正確顯示 (與學生表單的邏輯類似)
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            if self.instance.date:
                self.initial['date'] = self.instance.date.strftime('%Y-%m-%d')
            else:
                self.initial['date'] = ''
            if self.instance.academic_year:
                self.initial['academic_year'] = self.instance.academic_year

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
    student = forms.ModelChoiceField(
        queryset=Student.objects.all().order_by('name', 'student_id'),
        label="学生",
        empty_label="--- 选择学生 ---",
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
        student = cleaned_data.get('student')
        exam = cleaned_data.get('exam')
        
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
    
    # 使用隐藏字段存储选择的班级
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































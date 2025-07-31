from django import forms
from .models import Exam, ACADEMIC_YEAR_CHOICES, SUBJECT_CHOICES, Score
from school_management.students.models import Student, GRADE_LEVEL_CHOICES # 確保導入年級選項

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



































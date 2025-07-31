from django import forms
from .models import Exam, ACADEMIC_YEAR_CHOICES
from school_management.students.models import GRADE_LEVEL_CHOICES # 確保導入年級選項

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
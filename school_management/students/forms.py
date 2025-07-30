from django import forms
from .models import Student, Class # 確保導入 Class 模型

class StudentForm(forms.ModelForm):
    # 如果班級下拉式選單需要特殊排序，可以在這裡定義 queryset
    current_class = forms.ModelChoiceField(
        queryset=Class.objects.order_by('grade_level', 'class_name'), # 按年級班級排序
        label="当前班级",
        empty_label="-- 请选择班级 --" # 添加一個空白選項
    )

    class Meta:
        model = Student
        # 這裡列出你希望在表單中顯示的所有字段
        fields = [
            'student_id', 'name', 'gender', 'date_of_birth',
            'current_class', 'status', 'id_card_number',
            'student_enrollment_number', 'home_address',
            'guardian_name', 'guardian_contact_phone',
            'entry_date', 'graduation_date'
        ]
        # 你也可以為某些字段添加自定義的 widget 來改善顯示或輸入方式
        widgets = {
            'date_of_birth': forms.DateInput(attrs={'type': 'date'}),
            'entry_date': forms.DateInput(attrs={'type': 'date'}),
            'graduation_date': forms.DateInput(attrs={'type': 'date'}),
        }
        # 如果需要，還可以自定義字段的標籤
        labels = {
            'student_id': '学号',
            'name': '姓名',
            'gender': '性别',
            'date_of_birth': '出生日期',
            # ... 其他字段的標籤
        }
        # 如果某些字段不需要使用者填寫，但又希望在表單中出現，可以使用 exclude
        # exclude = ['field_to_exclude']
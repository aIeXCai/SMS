from django import forms
from .models import Student, Class, GRADE_LEVEL_CHOICES, STATUS_CHOICES, CLASS_NAME_CHOICES

class StudentForm(forms.ModelForm):
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
            'status', 'id_card_number', 'student_enrollment_number',
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

# ---  Excel 上傳表單 ---
class ExcelUploadForm(forms.Form):
    excel_file = forms.FileField(label="选择 Excel 文件")

# --- 批量修改狀態表單 ---
class BatchUpdateStatusForm(forms.Form):
    status = forms.ChoiceField(
        choices=STATUS_CHOICES,
        label="选择新的状态"
    )

# --- 批量升年級表單 ---
class BatchPromoteGradeForm(forms.Form):
    # 從哪個年級升級 (可以是空，表示不篩選)
    current_grade_level = forms.ChoiceField(
        choices=[('', '--- 选择当前年级 (可选) ---')] + GRADE_LEVEL_CHOICES,
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
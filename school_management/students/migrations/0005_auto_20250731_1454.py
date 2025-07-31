from django.db import migrations

def populate_grade_level_from_class(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    
    # 从current_class中提取grade_level并更新学生记录
    for student in Student.objects.all():
        if student.current_class and student.current_class.grade_level:
            student.grade_level = student.current_class.grade_level
            student.save()
        elif not student.grade_level:
            # 如果没有班级信息，设置一个默认值或跳过
            # 这里可以根据实际情况调整
            student.grade_level = '高一'  # 或者其他合适的默认值
            student.save()

def reverse_populate_grade_level(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    Student.objects.update(grade_level=None)

class Migration(migrations.Migration):
    dependencies = [
        ('students', '0004_alter_student_options_student_grade_level'),
    ]

    operations = [
        migrations.RunPython(
            populate_grade_level_from_class, 
            reverse_populate_grade_level
        ),
    ]
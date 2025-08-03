from django.core.management.base import BaseCommand
from school_management.students.models import Student

class Command(BaseCommand):
    help = '修复学生的年级字段，使其与当前班级的年级保持一致'

    def handle(self, *args, **options):
        updated_count = 0
        skipped_count = 0
        
        # 获取所有有班级的学生
        students_with_class = Student.objects.filter(current_class__isnull=False)
        
        self.stdout.write(f'找到 {students_with_class.count()} 名有班级的学生')
        
        for student in students_with_class:
            current_class_grade = student.current_class.grade_level
            student_grade = student.grade_level
            
            if student_grade != current_class_grade:
                self.stdout.write(
                    f'更新学生 {student.name} (学号: {student.student_id}) '
                    f'年级从 "{student_grade}" 改为 "{current_class_grade}"'
                )
                student.grade_level = current_class_grade
                student.save()
                updated_count += 1
            else:
                skipped_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'修复完成！更新了 {updated_count} 名学生的年级信息，'
                f'{skipped_count} 名学生的年级信息已经正确。'
            )
        )
        
        # 处理没有班级的学生
        students_without_class = Student.objects.filter(current_class__isnull=True)
        if students_without_class.exists():
            self.stdout.write(
                self.style.WARNING(
                    f'注意：有 {students_without_class.count()} 名学生没有分配班级，'
                    f'他们的年级信息保持不变。'
                )
            )
            for student in students_without_class:
                self.stdout.write(
                    f'  - {student.name} (学号: {student.student_id}) '
                    f'年级: {student.grade_level or "未设置"}'
                )
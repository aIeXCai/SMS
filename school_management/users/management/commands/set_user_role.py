from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = '设置用户角色和管理年级'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='用户名')
        parser.add_argument('role', type=str, choices=[
            'admin', 'grade_manager', 'subject_teacher', 'staff'
        ], help='角色 (admin/grade_manager/subject_teacher/staff)')
        parser.add_argument('--grade', type=str, help='负责年级（级长专用）', required=False)

    def handle(self, *args, **options):
        username = options['username']
        role = options['role']
        grade = options.get('grade')

        try:
            user = User.objects.get(username=username)
            user.role = role
            
            if role == 'grade_manager' and grade:
                user.managed_grade = grade
            elif role != 'grade_manager':
                user.managed_grade = None  # 非级长清空年级字段
                
            user.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'成功设置用户 {username} 的角色为 {role}'
                    + (f'，负责年级：{grade}' if grade else '')
                )
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'用户 {username} 不存在')
            )
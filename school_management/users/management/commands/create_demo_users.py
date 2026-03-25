from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = '批量创建用户并分配角色（支持新旧字段）'

    def handle(self, *args, **options):
        users_data = [
            {
                'username': 'teacher001',
                'password': 'teacher123',
                'email': 'teacher001@school.edu',
                'first_name': '张',
                'last_name': '老师',
                'role': 'subject_teacher'
            },
            {
                'username': 'manager001',
                'password': 'manager123',
                'email': 'manager001@school.edu',
                'first_name': '李',
                'last_name': '级长',
                'role': 'grade_manager',
                # 新字段
                'managed_section': 'senior',
                'managed_cohort_year': 2026,
                # 旧字段（兼容）
                'managed_grade': 'grade_10',
            },
            {
                'username': 'manager002',
                'password': 'manager123',
                'email': 'manager002@school.edu',
                'first_name': '王',
                'last_name': '初中级长',
                'role': 'grade_manager',
                'managed_section': 'junior',
                'managed_cohort_year': 2025,
                'managed_grade': 'grade_7',
            },
            {
                'username': 'staff001',
                'password': 'staff123',
                'email': 'staff001@school.edu',
                'first_name': '王',
                'last_name': '助理',
                'role': 'staff'
            }
        ]

        for user_data in users_data:
            username = user_data['username']

            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'用户 {username} 已存在，跳过创建')
                )
                continue

            user = User.objects.create_user(
                username=user_data['username'],
                password=user_data['password'],
                email=user_data.get('email', ''),
                first_name=user_data.get('first_name', ''),
                last_name=user_data.get('last_name', ''),
            )

            user.role = user_data['role']

            # 新字段
            if 'managed_section' in user_data:
                user.managed_section = user_data['managed_section']
            if 'managed_cohort_year' in user_data:
                user.managed_cohort_year = user_data['managed_cohort_year']
            # 旧字段（兼容）
            if 'managed_grade' in user_data:
                user.managed_grade = user_data['managed_grade']

            user.save()

            section_display = '初中' if user.managed_section == 'junior' else ('高中' if user.managed_section == 'senior' else '-')
            cohort_info = f'{section_display}{user.managed_cohort_year}级' if user.managed_section and user.managed_cohort_year else '-'

            self.stdout.write(
                self.style.SUCCESS(
                    f'成功创建用户 {username}，角色：{user_data["role"]}'
                    + (f'，负责：{cohort_info}' if user.role == 'grade_manager' else '')
                )
            )

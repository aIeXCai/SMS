from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = '批量创建用户并分配角色'

    def handle(self, *args, **options):
        # 示例用户数据 - 你可以根据需要修改
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
                'managed_grade': '高一'
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
            
            # 检查用户是否已存在
            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'用户 {username} 已存在，跳过创建')
                )
                continue
            
            # 创建用户
            user = User.objects.create_user(
                username=user_data['username'],
                password=user_data['password'],
                email=user_data.get('email', ''),
                first_name=user_data.get('first_name', ''),
                last_name=user_data.get('last_name', ''),
            )
            
            # 设置角色和年级
            user.role = user_data['role']
            if 'managed_grade' in user_data:
                user.managed_grade = user_data['managed_grade']
            
            user.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'成功创建用户 {username}，角色：{user_data["role"]}'
                    + (f'，负责年级：{user_data.get("managed_grade", "")}' 
                       if user_data.get("managed_grade") else '')
                )
            )
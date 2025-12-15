"""
用户管理命令
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from school_management.users.models import CustomUser

User = get_user_model()

class Command(BaseCommand):
    help = '管理系统用户'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-users',
            action='store_true',
            help='创建测试用户',
        )
        parser.add_argument(
            '--delete-user',
            type=str,
            help='删除指定用户名的用户',
        )

    def handle(self, *args, **options):
        if options['create_users']:
            self.create_test_users()
        elif options['delete_user']:
            self.delete_user(options['delete_user'])
        else:
            self.list_all_users()
        
    def create_test_users(self):
        """创建测试用户"""
        self.stdout.write("创建测试用户...")
        
        users_to_create = [
            {
                'username': 'admin',
                'email': 'admin@school.com',
                'password': 'admin123',
                'first_name': '系统',
                'last_name': '管理员',
                'role': CustomUser.RoleChoices.ADMIN,
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'username': 'teacher1',
                'email': 'teacher1@school.com',
                'password': 'teacher123',
                'first_name': '张',
                'last_name': '老师',
                'role': CustomUser.RoleChoices.SUBJECT_TEACHER,
                'is_staff': False,
                'is_superuser': False,
            },
            {
                'username': 'manager1',
                'email': 'manager1@school.com',
                'password': 'manager123',
                'first_name': '李',
                'last_name': '级长',
                'role': CustomUser.RoleChoices.GRADE_MANAGER,
                'managed_grade': '高一',
                'is_staff': False,
                'is_superuser': False,
            },
            {
                'username': 'staff1',
                'email': 'staff1@school.com',
                'password': 'staff123',
                'first_name': '王',
                'last_name': '教辅',
                'role': CustomUser.RoleChoices.STAFF,
                'is_staff': False,
                'is_superuser': False,
            }
        ]
        
        for user_data in users_to_create:
            username = user_data['username']
            if User.objects.filter(username=username).exists():
                self.stdout.write(f"  用户 {username} 已存在")
            else:
                password = user_data.pop('password')
                user = User.objects.create_user(**user_data)
                user.set_password(password)
                user.save()
                self.stdout.write(f"  ✅ 创建用户: {username}")
                
    def delete_user(self, username):
        """删除指定用户"""
        try:
            user = User.objects.get(username=username)
            user_info = f"{user.username} ({user.get_full_name() or '无姓名'})"
            
            # 确认删除
            self.stdout.write(f"准备删除用户: {user_info}")
            
            # 检查是否是超级用户
            if user.is_superuser:
                self.stdout.write(self.style.WARNING(f"  ⚠️  警告: {username} 是超级用户"))
            
            # 删除用户
            user.delete()
            self.stdout.write(self.style.SUCCESS(f"  ✅ 已删除用户: {user_info}"))
            
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"  ❌ 用户 {username} 不存在"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ❌ 删除用户时出错: {str(e)}"))
                
    def list_all_users(self):
        """列出所有用户"""
        self.stdout.write("所有用户列表:")
        users = User.objects.all().order_by('id')
        
        for user in users:
            self.stdout.write(
                f"  ID: {user.id:2d} | "
                f"用户名: {user.username:10s} | "
                f"姓名: {user.get_full_name() or '未设置':8s} | "
                f"角色: {user.get_role_display():6s}"
            )
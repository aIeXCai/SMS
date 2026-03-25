from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = '设置用户角色和管理年级（支持新旧字段）'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='用户名')
        parser.add_argument('role', type=str, choices=[
            'admin', 'grade_manager', 'subject_teacher', 'staff'
        ], help='角色 (admin/grade_manager/subject_teacher/staff)')
        # 新参数
        parser.add_argument('--section', type=str, choices=['junior', 'senior', '初中', '高中'],
                            help='负责学段（级长专用）: junior/初中 或 senior/高中')
        parser.add_argument('--cohort-year', type=int,
                            help='负责入学年份（级长专用）: 如 2026')
        # 旧参数（兼容）
        parser.add_argument('--grade', type=str,
                            help='负责年级（旧字段，兼容旧数据）', required=False)

    def handle(self, *args, **options):
        username = options['username']
        role = options['role']
        section = options.get('section')
        cohort_year = options.get('cohort_year')
        grade = options.get('grade')

        # 将中文 section 转为英文
        section_map = {'初中': 'junior', '高中': 'senior'}
        if section in section_map:
            section = section_map[section]

        try:
            user = User.objects.get(username=username)
            user.role = role

            if role == 'grade_manager':
                # 设置新字段
                if section:
                    user.managed_section = section
                if cohort_year:
                    user.managed_cohort_year = cohort_year
                # 同时兼容旧字段
                if grade:
                    user.managed_grade = grade
            else:
                # 非级长清空所有年级字段
                user.managed_section = None
                user.managed_cohort_year = None
                user.managed_grade = None

            user.save()

            new_fields = []
            if section and cohort_year:
                section_display = '初中' if section == 'junior' else '高中'
                new_fields.append(f'学段+年份: {section_display}{cohort_year}级')

            self.stdout.write(
                self.style.SUCCESS(
                    f'成功设置用户 {username} 的角色为 {role}'
                    + (f'，负责：{"，".join(new_fields)}' if new_fields else '')
                    + (f'（旧字段：{grade}）' if grade else '')
                )
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'用户 {username} 不存在')
            )

from django.apps import AppConfig


class StudentsGradesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'school_management.students_grades'
    verbose_name = '学生与成绩管理'

    def ready(self):
        # 导入 signals 以触发 @receiver 装饰器注册
        from . import signals  # noqa: F401

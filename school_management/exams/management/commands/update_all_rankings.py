from django.core.management.base import BaseCommand
from school_management.exams.models import Exam
from school_management.exams.views import update_grade_rankings

class Command(BaseCommand):
    help = '更新所有考试的年级排名'
    
    def handle(self, *args, **options):
        exams = Exam.objects.all()
        total = exams.count()
        
        self.stdout.write(f'开始更新 {total} 个考试的排名...')
        
        for i, exam in enumerate(exams, 1):
            try:
                update_grade_rankings(exam.pk)
                self.stdout.write(
                    self.style.SUCCESS(f'[{i}/{total}] 已更新考试 "{exam.name}" 的排名')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'[{i}/{total}] 更新考试 "{exam.name}" 排名失败: {e}')
                )
        
        self.stdout.write(self.style.SUCCESS('排名更新完成！'))
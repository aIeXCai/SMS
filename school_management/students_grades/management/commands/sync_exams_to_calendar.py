"""
同步现有考试到日历

用法:
    python manage.py sync_exams_to_calendar [--dry-run] [--exam-id EXAM_ID]

示例:
    # 同步所有考试
    python manage.py sync_exams_to_calendar

    # 预览（不实际创建）
    python manage.py sync_exams_to_calendar --dry-run

    # 只同步指定考试
    python manage.py sync_exams_to_calendar --exam-id 1
"""
from django.core.management.base import BaseCommand
from school_management.students_grades.models.exam import Exam
from school_management.students_grades.models.calendar import CalendarEvent


class Command(BaseCommand):
    help = '同步现有考试到日历'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅预览，不实际创建',
        )
        parser.add_argument(
            '--exam-id',
            type=int,
            help='只同步指定 ID 的考试',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        exam_id = options.get('exam_id')

        queryset = Exam.objects.all()
        if exam_id:
            queryset = queryset.filter(pk=exam_id)

        exams = list(queryset.order_by('date'))
        if not exams:
            self.stdout.write(self.style.WARNING('没有找到考试'))
            return

        self.stdout.write(f'找到 {len(exams)} 个考试')

        created = 0
        skipped = 0

        for exam in exams:
            # 检查是否已存在关联的日历事件
            existing = CalendarEvent.objects.filter(
                title=exam.name,
                start__date=exam.date,
                event_type='exam',
            ).first()

            if existing:
                skipped += 1
                status = self.style.WARNING(f'[跳过] {exam.name} ({exam.date}) - 已存在')
                self.stdout.write(status)
                continue

            if dry_run:
                self.stdout.write(
                    self.style.SUCCESS(f'[预览] 将创建: {exam.name} ({exam.date})')
                )
            else:
                CalendarEvent.objects.create(
                    title=exam.name,
                    start=exam.date,
                    end=None,
                    is_all_day=True,
                    event_type='exam',
                    description=exam.description or '',
                    grade=exam.grade_level or '',
                    visibility='school',
                    creator=None,  # 现有考试没有 creator 关联
                )
                created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'[创建] {exam.name} ({exam.date})')
                )

        if not dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n完成: 新建 {created} 个, 跳过 {skipped} 个 (已存在)'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'\n预览模式: 预计创建 {len(exams) - skipped} 个')
            )

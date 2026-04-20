# Generated manually
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def populate_exam_fk(apps, schema_editor):
    """
    为现有的 event_type='exam' 日历事件填充 exam FK。
    通过 title=name + start__date=date 匹配。
    """
    CalendarEvent = apps.get_model('students_grades', 'CalendarEvent')
    Exam = apps.get_model('students_grades', 'Exam')

    updated = 0
    for event in CalendarEvent.objects.filter(event_type='exam', exam__isnull=True):
        # 尝试通过标题匹配考试（title 理论上等于 exam.name）
        matched = Exam.objects.filter(name=event.title).first()
        if matched:
            event.exam = matched
            event.save(update_fields=['exam'])
            updated += 1

    print(f"[Migration] 为 {updated} 个考试日历事件填充了 exam FK")


def reverse_populate(apps, schema_editor):
    """回滚时不做任何事（FK 列本来就可为空）"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('students_grades', '0008_add_calendar_event_location'),
    ]

    operations = [
        # 1. exams 表加 created_by FK（可空）
        migrations.AddField(
            model_name='exam',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_exams',
                to=settings.AUTH_USER_MODEL,
                verbose_name='创建者',
            ),
        ),

        # 2. calendar_events 表加 exam FK（可空，CASCADE）
        migrations.AddField(
            model_name='calendarevent',
            name='exam',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='calendar_events',
                to='students_grades.exam',
                verbose_name='关联考试',
            ),
        ),

        # 3. 为现有数据填充 exam FK
        migrations.RunPython(populate_exam_fk, reverse_populate),
    ]

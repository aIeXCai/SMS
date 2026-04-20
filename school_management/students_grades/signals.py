"""
Exam ↔ CalendarEvent 同步信号

所有对 Exam 的增/改/删操作自动同步到关联的 CalendarEvent：
- Exam 新增 → 创建 CalendarEvent（visibility=school, event_type=exam）
- Exam 更新 → 同步更新关联的 CalendarEvent（title/date/description/grade）
- Exam 删除 → CASCADE 删除关联的 CalendarEvent（通过 FK on_delete=CASCADE）
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models.exam import Exam
from .models.calendar import CalendarEvent


@receiver(post_save, sender=Exam)
def sync_exam_to_calendar(sender, instance, created, **kwargs):
    """
    Exam 新增时：创建 CalendarEvent
    Exam 更新时：同步更新关联的 CalendarEvent
    """
    if created:
        # 新建考试 → 创建全校日历事件
        CalendarEvent.objects.create(
            title=instance.name,
            start=instance.date,
            end=None,
            is_all_day=True,
            event_type='exam',
            description=instance.description or '',
            grade=instance.grade_level or '',
            visibility='school',
            creator=instance.created_by,
            exam=instance,
        )
    else:
        # 更新考试 → 同步更新关联的日历事件
        try:
            event = instance.calendar_events.get(event_type='exam')
        except CalendarEvent.DoesNotExist:
            # 兜底：没有任何关联事件，创建一个
            CalendarEvent.objects.create(
                title=instance.name,
                start=instance.date,
                end=None,
                is_all_day=True,
                event_type='exam',
                description=instance.description or '',
                grade=instance.grade_level or '',
                visibility='school',
                creator=instance.created_by,
                exam=instance,
            )
            return

        event.title = instance.name
        event.start = instance.date
        event.description = instance.description or ''
        event.grade = instance.grade_level or ''
        # 注意：creator 不变（保持创建者），exam FK 本身就是对的
        event.save(update_fields=['title', 'start', 'description', 'grade'])

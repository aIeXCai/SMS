import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class CalendarEvent(models.Model):
    """日历日程模型"""

    VISIBILITY_CHOICES = [
        ('personal', '个人'),
        ('grade', '年级'),
        ('school', '全校'),
    ]

    EVENT_TYPE_CHOICES = [
        ('exam', '考试'),
        ('meeting', '会议'),
        ('activity', '活动'),
        ('reminder', '提醒'),
        ('other', '其他'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField('标题', max_length=100)
    start = models.DateTimeField('开始时间')
    end = models.DateTimeField('结束时间', null=True, blank=True)
    is_all_day = models.BooleanField('全天事件', default=False)
    event_type = models.CharField('类型', max_length=20, choices=EVENT_TYPE_CHOICES, default='other')
    description = models.TextField('描述', blank=True, default='')
    location = models.CharField('地点', max_length=200, blank=True, default='')
    grade = models.CharField('年级', max_length=50, blank=True, default='')
    visibility = models.CharField('可见性', max_length=20, choices=VISIBILITY_CHOICES, default='personal')
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_events', verbose_name='创建者', null=True, blank=True)
    # 关联考试（通过 signals 自动同步）
    exam = models.ForeignKey('students_grades.Exam', on_delete=models.CASCADE, related_name='calendar_events', verbose_name='关联考试', null=True, blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'calendar_events'
        ordering = ['start']
        verbose_name = '日程'
        verbose_name_plural = '日程'

    def __str__(self):
        return f"{self.title} ({self.get_visibility_display()})"

    def get_visibility_display(self):
        return dict(self.VISIBILITY_CHOICES).get(self.visibility, self.visibility)

    def get_event_type_display(self):
        return dict(self.EVENT_TYPE_CHOICES).get(self.event_type, self.event_type)
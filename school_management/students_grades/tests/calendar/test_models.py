from django.contrib.auth import get_user_model
from django.test import TestCase
from school_management.students_grades.models.calendar import CalendarEvent


class CalendarEventModelTest(TestCase):
    """测试 CalendarEvent 模型"""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="teacher1", password="test123")
        self.admin = User.objects.create_superuser(username="admin1", password="admin123")

    def test_create_personal_event(self):
        """测试创建个人日程"""
        event = CalendarEvent.objects.create(
            title="个人会议",
            start="2026-04-20T09:00:00",
            event_type="meeting",
            visibility="personal",
            creator=self.user,
        )
        self.assertEqual(event.title, "个人会议")
        self.assertEqual(event.visibility, "personal")
        self.assertEqual(str(event), "个人会议 (个人)")

    def test_create_school_event(self):
        """测试创建全校日程"""
        event = CalendarEvent.objects.create(
            title="全校大会",
            start="2026-04-21T10:00:00",
            event_type="meeting",
            visibility="school",
            creator=self.admin,
        )
        self.assertEqual(event.visibility, "school")

    def test_create_grade_event(self):
        """测试创建年级日程"""
        event = CalendarEvent.objects.create(
            title="年级备课",
            start="2026-04-22T14:00:00",
            event_type="meeting",
            visibility="grade",
            grade="初一",
            creator=self.user,
        )
        self.assertEqual(event.visibility, "grade")
        self.assertEqual(event.grade, "初一")

    def test_all_day_event(self):
        """测试全天事件"""
        event = CalendarEvent.objects.create(
            title="校运动会",
            start="2026-05-01T00:00:00",
            is_all_day=True,
            event_type="activity",
            visibility="school",
            creator=self.admin,
        )
        self.assertTrue(event.is_all_day)
        self.assertIsNone(event.end)

    def test_event_type_display(self):
        """测试日程类型显示"""
        event = CalendarEvent.objects.create(
            title="期中考试",
            start="2026-04-20T09:00:00",
            event_type="exam",
            visibility="school",
            creator=self.admin,
        )
        self.assertEqual(event.get_event_type_display(), "考试")
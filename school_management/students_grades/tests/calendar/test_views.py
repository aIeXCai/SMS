from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from school_management.students_grades.models.calendar import CalendarEvent


class CalendarEventViewSetTest(TestCase):
    """测试 CalendarEvent ViewSet API"""

    def setUp(self):
        User = get_user_model()
        self.client = APIClient()
        self.teacher = User.objects.create_user(username="teacher1", password="test123")
        self.admin = User.objects.create_superuser(username="admin1", password="admin123")
        self.other_teacher = User.objects.create_user(username="teacher2", password="test123")

    def test_list_personal_events_own_only(self):
        """测试个人日程只返回自己的"""
        CalendarEvent.objects.create(
            title="我的备忘",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.teacher,
        )
        CalendarEvent.objects.create(
            title="他人的备忘",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.other_teacher,
        )
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get("/api/calendar-events/")
        self.assertEqual(response.status_code, 200)
        # 应该只返回自己的日程
        titles = [e['title'] for e in response.data['results'] if e['visibility'] == 'personal']
        self.assertIn("我的备忘", titles)
        self.assertNotIn("他人的备忘", titles)

    def test_list_school_events_visible_to_all(self):
        """测试全校日程对所有用户可见"""
        CalendarEvent.objects.create(
            title="全校大会",
            start="2026-04-21T10:00:00",
            visibility="school",
            creator=self.admin,
        )
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get("/api/calendar-events/")
        self.assertEqual(response.status_code, 200)
        titles = [e['title'] for e in response.data['results']]
        self.assertIn("全校大会", titles)

    def test_teacher_cannot_create_school_event(self):
        """测试普通教师不能创建全校日程"""
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post("/api/calendar-events/", {
            "title": "全校大会",
            "start": "2026-04-21T10:00:00",
            "visibility": "school",
            "event_type": "meeting",
        })
        self.assertEqual(response.status_code, 400)

    def test_teacher_cannot_create_grade_event(self):
        """测试普通教师不能创建年级日程"""
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post("/api/calendar-events/", {
            "title": "年级备课",
            "start": "2026-04-22T14:00:00",
            "visibility": "grade",
            "grade": "初一",
            "event_type": "meeting",
        })
        self.assertEqual(response.status_code, 400)

    def test_grade_event_requires_grade_field(self):
        """测试创建年级日程必须指定年级"""
        # 给 teacher 设置 grade_manager 角色
        self.teacher.role = 'grade_manager'
        self.teacher.managed_grade = '初一'
        self.teacher.save()
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post("/api/calendar-events/", {
            "title": "年级备课",
            "start": "2026-04-22T14:00:00",
            "visibility": "grade",
            "event_type": "meeting",
        })
        self.assertEqual(response.status_code, 400)

    def test_teacher_can_create_personal_event(self):
        """测试教师可以创建个人日程"""
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post("/api/calendar-events/", {
            "title": "个人备忘",
            "start": "2026-04-20T09:00:00",
            "visibility": "personal",
            "event_type": "reminder",
        })
        self.assertEqual(response.status_code, 201)

    def test_update_event_by_creator(self):
        """测试创建者可以更新日程"""
        event = CalendarEvent.objects.create(
            title="原标题",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.teacher,
        )
        self.client.force_authenticate(user=self.teacher)
        response = self.client.patch(
            f"/api/calendar-events/{event.id}/",
            {"title": "新标题"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        event.refresh_from_db()
        self.assertEqual(event.title, "新标题")

    def test_update_event_by_non_creator_forbidden(self):
        """测试非创建者不能更新日程"""
        event = CalendarEvent.objects.create(
            title="老师的日程",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.teacher,
        )
        self.client.force_authenticate(user=self.other_teacher)
        response = self.client.patch(
            f"/api/calendar-events/{event.id}/",
            {"title": "被篡改"},
            format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_delete_event_by_admin(self):
        """测试管理员可以删除任何日程"""
        event = CalendarEvent.objects.create(
            title="老师的日程",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.teacher,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/calendar-events/{event.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(CalendarEvent.objects.filter(id=event.id).exists())

    def test_delete_event_by_non_creator_forbidden(self):
        """测试非创建者不能删除日程"""
        event = CalendarEvent.objects.create(
            title="老师的日程",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.teacher,
        )
        self.client.force_authenticate(user=self.other_teacher)
        response = self.client.delete(f"/api/calendar-events/{event.id}/")
        self.assertEqual(response.status_code, 403)
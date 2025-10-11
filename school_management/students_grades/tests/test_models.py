"""
Model tests for students_grades application.

This file contains unit tests for core models: Exam, ExamSubject, Student, Class, and Score.

Guidelines and intent:
- Use Django's TestCase which wraps each test in a transaction and provides an isolated test database.
- Keep tests independent: each test creates its own objects and does not rely on previous tests.
- Prefer asserting behavior (what the model does) rather than internal implementation details.

How to run these tests locally:
    cd /Users/caijinbin/Desktop/白实/信息/信息管理系统/SMS
    # using system python3; adjust if using virtualenv
    python3 manage.py test school_management.students_grades.tests.test_models -v 2
"""

from django.test import TestCase
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError
from decimal import Decimal

# Import the models under test. Use absolute imports matching the project layout.
from school_management.students_grades.models.exam import Exam, ExamSubject, SUBJECT_DEFAULT_MAX_SCORES
from school_management.students_grades.models.student import Student, Class
from school_management.students_grades.models.score import Score


class StudentTests(TestCase):
    """Tests covering Student model behaviors and validations."""

    def test_student_str_and_unique(self):
        """Student.__str__ should include name and student_id; uniqueness of student_id is enforced."""
        c = Class.objects.create(grade_level='初一', class_name='1班')
        # with class
        s = Student.objects.create(student_id='SSTR1', name='张三', current_class=c, grade_level='初一')
        self.assertEqual(str(s), '张三 (SSTR1) - 初一1班')

        # without class
        s2 = Student.objects.create(student_id='SSTR2', name='李四', grade_level='初二')
        self.assertIn('未分班', str(s2))

        # duplicate student_id should raise IntegrityError at DB level
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Student.objects.create(student_id='SSTR1', name='重复', grade_level='初一')

    def test_student_validators(self):
        """Test validators for id_card_number and guardian_contact_phone."""
        # Test valid id_card_number (use a realistic example matching the project's regex)
        s = Student(student_id='S202', name='学生丙', id_card_number='110101198001011234')
        try:
            s.full_clean()  # This should not raise a ValidationError
        except ValidationError:
            self.fail("id_card_number validation failed for a valid number.")

        # Test invalid id_card_number
        s.id_card_number = 'invalid_id'
        with self.assertRaises(ValidationError):
            s.full_clean()

        # restore a known-valid id_card_number before testing guardian_contact_phone
        s.id_card_number = '110101200605151234'

        # Test valid guardian_contact_phone
        s.guardian_contact_phone = '13800138000'
        try:
            s.full_clean()  # This should not raise a ValidationError
        except ValidationError:
            self.fail("guardian_contact_phone validation failed for a valid number.")

        # Test invalid guardian_contact_phone
        s.guardian_contact_phone = 'invalid_phone'
        with self.assertRaises(ValidationError):
            s.full_clean()

    def test_student_id_and_id_card_uniqueness(self):
        """Ensure student_id and id_card_number uniqueness constraints are enforced at DB level."""
        c = Class.objects.create(grade_level='高一', class_name='1班')
        # student_id uniqueness
        Student.objects.create(student_id='UNQID1', name='A', current_class=c, grade_level='高一')
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Student.objects.create(student_id='UNQID1', name='B', current_class=c, grade_level='高一')

        # id_card_number uniqueness
        good_id = '110101200605151234'
        Student.objects.create(student_id='UNQID2', name='C', current_class=c, grade_level='高一', id_card_number=good_id)
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Student.objects.create(student_id='UNQID3', name='D', current_class=c, grade_level='高一', id_card_number=good_id)

    def test_student_enrollment_number_uniqueness(self):
        """Test uniqueness of student_enrollment_number."""
        c = Class.objects.create(grade_level='初三', class_name='3班')
        Student.objects.create(student_id='S203', name='学生丁', current_class=c, grade_level='初三', student_enrollment_number='ENR001')
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Student.objects.create(student_id='S204', name='学生戊', current_class=c, grade_level='初三', student_enrollment_number='ENR001')


class ExamTests(TestCase):
    """Tests related to the Exam model and its helpers."""

    def test_exam_str_with_and_without_academic_year(self):
        """Exam.__str__ should include the exam name; when academic_year is present it should be visible.

        Setup:
        - create two Exam instances: one without academic_year and one with.

        Assertion:
        - str(exam) contains expected substrings.
        """
        e1 = Exam.objects.create(name='期中考试', grade_level='初一', date='2025-09-01')
        self.assertIn('期中考试', str(e1))

        # with academic year: representation should also include the academic year when available
        e2 = Exam.objects.create(name='期末考试', grade_level='初二', date='2025-09-02', academic_year='2025-2026')
        self.assertIn('2025-2026', str(e2))

    def test_exam_unique_together(self):
        """If the project enforces a uniqueness constraint for (name, academic_year, grade_level),
        attempting to create a duplicate should raise IntegrityError at the database layer.
        """
        Exam.objects.create(name='月考', grade_level='初一', date='2025-09-03', academic_year='2025-2026')
        with self.assertRaises(IntegrityError):
            Exam.objects.create(name='月考', grade_level='初一', date='2025-09-04', academic_year='2025-2026')

    def test_exam_default_subjects_and_default_max_for_unknown_grade(self):
        """当年级不在 SUBJECT_DEFAULT_MAX_SCORES 中时，应返回空配置，默认满分方法返回 100。"""
        exam = Exam.objects.create(name='未知年级考', grade_level='不存在年级', date='2025-09-12')
        self.assertEqual(exam.get_default_subjects_config(), {})
        self.assertEqual(ExamSubject.get_default_max_score('不存在年级', '语文'), 100)

    def test_exam_str_formats(self):
        """确保 Exam.__str__ 在不同 academic_year 值下格式正确，不出现 'None' 或额外空格。"""
        e_none = Exam.objects.create(name='无学年考', grade_level='初一', date='2025-09-22', academic_year=None)
        self.assertEqual(str(e_none), '无学年考 (初一)')

        e_empty = Exam.objects.create(name='空学年考', grade_level='初二', date='2025-09-23', academic_year='')
        self.assertEqual(str(e_empty), '空学年考 (初二)')

        e_with = Exam.objects.create(name='有学年考', grade_level='初三', date='2025-09-24', academic_year='2025-2026')
        self.assertEqual(str(e_with), '2025-2026 有学年考 (初三)')

    def test_default_subjects_have_expected_keys_for_known_grade(self):
        """对于已知年级，默认科目配置应非空并包含常见科目（例如 '语文'）。"""
        exam = Exam.objects.create(name='默认科目测', grade_level='初一', date='2025-10-02')
        cfg = exam.get_default_subjects_config()
        self.assertIsInstance(cfg, dict)
        # 至少包含语文这类常见科目
        self.assertIn('语文', cfg)


class ExamSubjectTests(TestCase):
    """Tests around ExamSubject behavior and defaults."""

    def test_examsubject_auto_name_and_default_max(self):
        """ExamSubject should default subject_name from subject_code when omitted, and
        the helper to get default max scores should return the configured value for the grade.
        """
        exam = Exam.objects.create(name='小测', grade_level='初一', date='2025-09-05')
        subj = ExamSubject.objects.create(exam=exam, subject_code='语文', max_score=120)
        # subject_name should default to subject_code when not provided
        self.assertEqual(subj.subject_name, '语文')

        # default max score via classmethod / constant lookup
        self.assertEqual(ExamSubject.get_default_max_score('初一', '语文'), SUBJECT_DEFAULT_MAX_SCORES['初一']['语文'])

    def test_examsubject_unique_together(self):
        """Ensure duplicate ExamSubject (same exam + subject_code) is rejected by DB uniqueness."""
        exam = Exam.objects.create(name='模拟', grade_level='初一', date='2025-09-06')
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=120)
        with self.assertRaises(IntegrityError):
            ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=120)

    def test_examsubject_preserves_custom_name_on_save(self):
        """如果创建时提供了自定义 subject_name，则保存后该名称应保留而不会被覆盖为 subject_code。"""
        exam = Exam.objects.create(name='自定义名测', grade_level='初二', date='2025-10-03')
        subj = ExamSubject.objects.create(exam=exam, subject_code='物理', subject_name='自定义物理', max_score=100)
        self.assertEqual(subj.subject_name, '自定义物理')


class ClassStudentTests(TestCase):
    """Tests covering Class and Student models and their string/uniqueness behaviors."""

    def test_class_str_and_unique(self):
        """Class.__str__ should produce a combined grade+class name, and duplicate class per grade should be rejected."""
        c = Class.objects.create(grade_level='初一', class_name='1班')
        # string form is grade + class_name
        self.assertEqual(str(c), '初一1班')

        # duplicate (same grade_level and class_name) should violate unique_together
        with self.assertRaises(IntegrityError):
            Class.objects.create(grade_level='初一', class_name='1班')

    def test_student_str_and_unique_and_unassigned_class(self):
        """Student string includes name and student_id; on no current_class it shows '未分班'.

        Also verifies that student_id uniqueness is enforced by the DB.
        """
        c = Class.objects.create(grade_level='初二', class_name='2班')
        s = Student.objects.create(student_id='S200', name='学生甲', current_class=c, grade_level='初二')
        # should contain name and id
        s_str = str(s)
        self.assertIn('学生甲', s_str)
        self.assertIn('S200', s_str)

        # student without class should show '未分班'
        s2 = Student.objects.create(student_id='S201', name='学生乙', grade_level='初三')
        self.assertIn('未分班', str(s2))

        # duplicate student_id should raise IntegrityError
        with self.assertRaises(IntegrityError):
            Student.objects.create(student_id='S200', name='重复学号', grade_level='初二')
    

    def test_class_without_homeroom_teacher_and_str(self):
        """Class 应允许 homeroom_teacher 为空，且 __str__ 在无班主任时仍然正常工作。"""
        c = Class.objects.create(grade_level='初一', class_name='7班')
        self.assertIsNone(c.homeroom_teacher)
        self.assertEqual(str(c), '初一7班')

    def test_student_optional_dates_and_str_when_missing(self):
        """Student 的可选日期字段（entry_date, graduation_date）可以为 None，且 __str__ 不应失败。"""
        s = Student.objects.create(student_id='S701', name='可选日期生', grade_level='初一')
        self.assertIsNone(s.entry_date)
        self.assertIsNone(s.graduation_date)
        # 没有分班时应包含 '未分班'
        self.assertIn('未分班', str(s))


class ScoreTests(TestCase):
    """Tests covering Score behaviors, validations and computed helpers."""

    def test_score_autolink_and_validations(self):
        """Score should automatically link to the matching ExamSubject (by exam and subject)
        and enforce max score validation when saving.
        """
        c = Class.objects.create(grade_level='初一', class_name='1班')
        s = Student.objects.create(student_id='S100', name='测试生', current_class=c, grade_level='初一')
        exam = Exam.objects.create(name='综合', grade_level='初一', date='2025-09-07')
        subj = ExamSubject.objects.create(exam=exam, subject_code='物理', subject_name='物理', max_score=100)

        # create score with subject matching exam_subject: Score.save() should set exam_subject
        score = Score.objects.create(student=s, exam=exam, subject='物理', score_value=90)
        self.assertIsNotNone(score.exam_subject)
        self.assertEqual(score.get_max_score(), 100)

        # creating score exceeding max should raise ValidationError on save
        s2 = Student.objects.create(student_id='S101', name='超分生', current_class=c, grade_level='初一')
        bad = Score(student=s2, exam=exam, subject='物理', score_value=150)
        with self.assertRaises(ValidationError):
            bad.save()

    def test_score_exam_subject_mismatch_raises(self):
        """如果 exam_subject 与 score.subject 不一致，应在 save()/clean() 时抛出 ValidationError。"""
        exam = Exam.objects.create(name='检验考', grade_level='初一', date='2025-09-10')
        # 创建一个物理科目的 ExamSubject
        es = ExamSubject.objects.create(exam=exam, subject_code='物理', subject_name='物理', max_score=100)
        c = Class.objects.create(grade_level='初一', class_name='3班')
        s = Student.objects.create(student_id='S300', name='对比生', current_class=c, grade_level='初一')

        # 尝试用不匹配的 subject（化学）并指定 exam_subject 应当失败
        bad_score = Score(student=s, exam=exam, exam_subject=es, subject='化学', score_value=50)
        with self.assertRaises(ValidationError):
            bad_score.save()

    def test_score_unique_together_raises_integrity(self):
        """重复的 (student, exam, subject) 插入应引发 IntegrityError（数据库约束）。"""
        exam = Exam.objects.create(name='重复考', grade_level='初二', date='2025-09-11')
        es = ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=120)
        c = Class.objects.create(grade_level='初二', class_name='4班')
        s = Student.objects.create(student_id='S400', name='重复分生', current_class=c, grade_level='初二')

        Score.objects.create(student=s, exam=exam, subject='语文', score_value=80)
        # 再次创建相同 student/exam/subject 应该在 DB 层失败
        with self.assertRaises(IntegrityError):
            Score.objects.create(student=s, exam=exam, subject='语文', score_value=85)

    def test_score_percentage_zero_and_decimal(self):
        """验证当满分为 0 时返回 0，及小数分数的百分比计算精度。"""
        exam = Exam.objects.create(name='百分比测', grade_level='初一', date='2025-09-20')
        es_zero = ExamSubject.objects.create(exam=exam, subject_code='体育', subject_name='体育', max_score=0)
        c = Class.objects.create(grade_level='初一', class_name='5班')
        s = Student.objects.create(student_id='S500', name='百分率生', current_class=c, grade_level='初一')

        score_zero = Score.objects.create(student=s, exam=exam, exam_subject=es_zero, subject='体育', score_value=0)
        self.assertEqual(score_zero.get_max_score(), 0)
        self.assertEqual(score_zero.get_score_percentage(), 0)

        # 小数精度测试：max=50, score=45.5 -> 百分比约为 91.0
        es = ExamSubject.objects.create(exam=exam, subject_code='物理', subject_name='物理', max_score=50)
        score_dec = Score.objects.create(student=s, exam=exam, exam_subject=es, subject='物理', score_value=Decimal('45.50'))
        self.assertAlmostEqual(score_dec.get_score_percentage(), (45.5/50)*100, places=6)

    def test_score_grade_level_boundaries(self):
        """测试 get_grade_level 在边界值的返回（85/70/60）。"""
        exam = Exam.objects.create(name='等级测', grade_level='初一', date='2025-09-21')
        es = ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)
        c = Class.objects.create(grade_level='初一', class_name='6班')
        s = Student.objects.create(student_id='S600', name='等级生', current_class=c, grade_level='初一')

        def make_and_check(val, expected):
            obj, created = Score.objects.get_or_create(
                student=s, exam=exam, subject='数学',
                defaults={'exam_subject': es, 'score_value': Decimal(str(val))}
            )
            if not created:
                obj.score_value = Decimal(str(val))
                obj.exam_subject = es
                obj.save()
            self.assertEqual(obj.get_grade_level(), expected)

        make_and_check(85, "优秀")
        make_and_check(84.99, "良好")
        make_and_check(70, "良好")
        make_and_check(69.99, "及格")
        make_and_check(60, "及格")
        make_and_check(59.99, "不及格")

    def test_score_str_formats_with_and_without_academic_year(self):
        """Score.__str__ 在 exam 有/无 academic_year 时格式应合理，不包含 'None' 文本。"""
        exam_with = Exam.objects.create(name='年考A', grade_level='初一', date='2025-10-04', academic_year='2025-2026')
        exam_without = Exam.objects.create(name='年考B', grade_level='初一', date='2025-10-05')
        es = ExamSubject.objects.create(exam=exam_with, subject_code='物理', subject_name='物理', max_score=100)
        c = Class.objects.create(grade_level='初一', class_name='8班')
        s = Student.objects.create(student_id='S800', name='格式生', current_class=c, grade_level='初一')

        score1 = Score.objects.create(student=s, exam=exam_with, exam_subject=es, subject='物理', score_value=Decimal('50'))
        self.assertIn('2025-2026', str(score1))

        # 使用不同 exam（无 academic_year）时，不应包含 'None' 文本
        # 为了关联同一科目到不同 exam，我们为 exam_without 创建对应的 ExamSubject
        es2 = ExamSubject.objects.create(exam=exam_without, subject_code='物理', subject_name='物理', max_score=100)
        score2 = Score.objects.create(student=s, exam=exam_without, exam_subject=es2, subject='物理', score_value=Decimal('60'))
        self.assertNotIn('None', str(score2))

    def test_score_exam_subject_deleted_sets_null_and_fallback_max(self):
        """当关联的 ExamSubject 被删除时，Score.exam_subject 应变为 NULL，get_max_score 应退回到默认值。"""
        exam = Exam.objects.create(name='回退测', grade_level='初一', date='2025-10-06')
        es = ExamSubject.objects.create(exam=exam, subject_code='化学', subject_name='化学', max_score=90)
        c = Class.objects.create(grade_level='初一', class_name='9班')
        s = Student.objects.create(student_id='S900', name='回退生', current_class=c, grade_level='初一')

        score = Score.objects.create(student=s, exam=exam, exam_subject=es, subject='化学', score_value=Decimal('80'))
        # 删除 ExamSubject，应触发 Score.exam_subject -> NULL（on_delete=SET_NULL）
        es.delete()
        score.refresh_from_db()
        self.assertIsNone(score.exam_subject)
        # get_max_score 此时应使用默认值（根据年级与科目）
        expected_default = ExamSubject.get_default_max_score(exam.grade_level, score.subject)
        self.assertEqual(score.get_max_score(), expected_default)

    def test_score_equal_to_max_is_valid_and_percentage_100(self):
        """边界测试：score_value 等于 exam_subject.max_score 应当合法，百分比为 100，等级为优秀（阈值 >=85）。"""
        exam = Exam.objects.create(name='等值测', grade_level='初一', date='2025-10-10')
        es = ExamSubject.objects.create(exam=exam, subject_code='物理', subject_name='物理', max_score=100)
        c = Class.objects.create(grade_level='初一', class_name='1班')
        s = Student.objects.create(student_id='S1000', name='边界生', current_class=c, grade_level='初一')

        # 等于 max 值应被接受
        score = Score.objects.create(student=s, exam=exam, exam_subject=es, subject='物理', score_value=100)
        self.assertEqual(score.get_max_score(), 100)
        self.assertAlmostEqual(score.get_score_percentage(), 100.0, places=6)
        # 百分之百应属于优秀等级（符合项目中 85 以上为优秀的规则）
        self.assertEqual(score.get_grade_level(), '优秀')

    def test_score_negative_or_non_numeric_value_raises_validation(self):
        """验证负分和非数值输入会被模型校验拒绝（抛出 ValidationError）。"""
        exam = Exam.objects.create(name='非法分测', grade_level='初一', date='2025-10-11')
        es = ExamSubject.objects.create(exam=exam, subject_code='化学', subject_name='化学', max_score=100)
        c = Class.objects.create(grade_level='初一', class_name='2班')
        s = Student.objects.create(student_id='S1001', name='非法生', current_class=c, grade_level='初一')

        # 负分应被拒绝
        neg = Score(student=s, exam=exam, exam_subject=es, subject='化学', score_value=-1)
        with self.assertRaises(ValidationError):
            neg.full_clean()

        # 非数值（字符串）应被拒绝或在 full_clean 时触发 ValidationError
        nonnum = Score(student=s, exam=exam, exam_subject=es, subject='化学', score_value='not_a_number')
        with self.assertRaises(ValidationError):
            nonnum.full_clean()

    def test_score_save_without_student_or_exam_raises(self):
        """缺少必需的外键（student 或 exam）在保存时应触发 DB 层或验证错误（IntegrityError/TypeError）。"""
        exam = Exam.objects.create(name='缺关联测', grade_level='初一', date='2025-10-12')
        es = ExamSubject.objects.create(exam=exam, subject_code='生物', subject_name='生物', max_score=100)

        # 尝试在 DB 层插入缺少 student 的记录 -> IntegrityError
        with transaction.atomic():
            with self.assertRaises(Exception):
                # 使用 create 直接写入，会触发 integrity error（NOT NULL 约束）
                Score.objects.create(student=None, exam=exam, exam_subject=es, subject='生物', score_value=50)

        # 尝试缺少 exam 的情况
        c = Class.objects.create(grade_level='初一', class_name='3班')
        s = Student.objects.create(student_id='S1002', name='缺考生', current_class=c, grade_level='初一')
        with transaction.atomic():
            with self.assertRaises(Exception):
                Score.objects.create(student=s, exam=None, exam_subject=es, subject='生物', score_value=50)


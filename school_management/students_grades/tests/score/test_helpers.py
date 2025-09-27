"""Unit tests for analysis helper functions used by the analysis views."""
from datetime import date
import json

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score
from school_management.students_grades.views.score_views import (
    _analyze_single_class,
    _analyze_multiple_classes,
    _analyze_grade,
)


class AnalysisHelpersTests(BaseTestCase):
    """Unit test for analysis helper functions (small dataset sanity checks)."""

    def test_analyze_single_class_basic_stats(self):
        # 创建班级/学生/考试/科目/成绩，用于直接调用 _analyze_single_class
        cls = Class.objects.create(grade_level='G', class_name='1班')
        s1 = Student.objects.create(student_id='T1', name='T1', grade_level='G', current_class=cls)
        exam = Exam.objects.create(name='E1', academic_year='AY', grade_level='G', date=date(2024, 1, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)

        Score.objects.create(student=s1, exam=exam, subject='语文', score_value=60)
        Score.objects.create(student=s1, exam=exam, subject='数学', score_value=80)

        scores = Score.objects.filter(exam=exam, student__current_class=cls)
        result = _analyze_single_class(scores, cls, exam)

        # 基本断言：total_students, class_avg_total, student_rankings 等存在且合理
        self.assertEqual(result['total_students'], 1)
        # class_avg_total 等于 (60+80)=140
        self.assertAlmostEqual(result['class_avg_total'], 140.0, places=2)
        self.assertIn('subject_stats', result)
        self.assertIn('student_rankings', result)

    def test_analyze_multiple_classes_basic_stats(self):
        """Verify multiple-class aggregation returns per-class statistics and subjects list."""
        # 设置两个班级与学生、考试、科目与成绩
        c1 = Class.objects.create(grade_level='Gx', class_name='1班')
        c2 = Class.objects.create(grade_level='Gx', class_name='2班')
        s1 = Student.objects.create(student_id='M1', name='M1', grade_level='Gx', current_class=c1)
        s2 = Student.objects.create(student_id='M2', name='M2', grade_level='Gx', current_class=c2)

        exam = Exam.objects.create(name='E_multi', academic_year='AY', grade_level='Gx', date=date(2024, 3, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)

        # s1: 50,50  total 100
        Score.objects.create(student=s1, exam=exam, subject='语文', score_value=50)
        Score.objects.create(student=s1, exam=exam, subject='数学', score_value=50)

        # s2: 80,10 total 90
        Score.objects.create(student=s2, exam=exam, subject='语文', score_value=80)
        Score.objects.create(student=s2, exam=exam, subject='数学', score_value=10)

        res = _analyze_multiple_classes([c1, c2], exam)

        # 包含两个班级统计
        self.assertIn('class_statistics', res)
        # subjects 中包含两个科目
        self.assertEqual(len(res.get('subjects', [])), 2)
        # total_students 为 2
        self.assertEqual(res.get('total_students'), 2)

    def test_analyze_grade_basic_stats_and_excellent_rate(self):
        """Verify grade-level aggregation computes total_max_score and excellent rate correctly."""
        # 创建两个班级及学生
        ca = Class.objects.create(grade_level='Gy', class_name='1班')
        cb = Class.objects.create(grade_level='Gy', class_name='2班')
        sa = Student.objects.create(student_id='GA1', name='GA1', grade_level='Gy', current_class=ca)
        sb = Student.objects.create(student_id='GB1', name='GB1', grade_level='Gy', current_class=cb)

        exam = Exam.objects.create(name='E_grade', academic_year='AY', grade_level='Gy', date=date(2024, 4, 1))
        # 两科：满分 100 & 100 -> total_max_score = 200
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)

        # sa 得到 190 (95%) -> 被视作优秀(>=95%)
        Score.objects.create(student=sa, exam=exam, subject='语文', score_value=95)
        Score.objects.create(student=sa, exam=exam, subject='数学', score_value=95)

        # sb 得到 150 (75%) -> 非优秀
        Score.objects.create(student=sb, exam=exam, subject='语文', score_value=80)
        Score.objects.create(student=sb, exam=exam, subject='数学', score_value=70)

        res = _analyze_grade(exam, 'Gy')

        # total_max_score 应为 200
        self.assertEqual(res.get('total_max_score'), 200)
        # total_students 应为 2
        self.assertEqual(res.get('total_students'), 2)
        # excellent_rate = 50.0 (1 / 2 * 100)
        self.assertAlmostEqual(res.get('excellent_rate'), 50.0, places=2)

    def test_analyze_single_class_handles_missing_scores_and_none(self):
        """Ensure single-class analysis gracefully handles missing subject entries (partial scores)."""
        cls = Class.objects.create(grade_level='Gz', class_name='1班')
        s1 = Student.objects.create(student_id='Z1', name='Z1', grade_level='Gz', current_class=cls)
        s2 = Student.objects.create(student_id='Z2', name='Z2', grade_level='Gz', current_class=cls)

        exam = Exam.objects.create(name='E_missing', academic_year='AY', grade_level='Gz', date=date(2024, 5, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)

        # s1 有两科成绩
        Score.objects.create(student=s1, exam=exam, subject='语文', score_value=70)
        Score.objects.create(student=s1, exam=exam, subject='数学', score_value=80)

        # s2 只存在语文成绩，数学缺科
        Score.objects.create(student=s2, exam=exam, subject='语文', score_value=60)

        scores = Score.objects.filter(exam=exam, student__current_class=cls)
        res = _analyze_single_class(scores, cls, exam)

        # total_students 应为 2
        self.assertEqual(res.get('total_students'), 2)
        # subject_stats 中应包含两个科目的统计（数学平均应基于已有分数计算）
        self.assertIn('subject_stats', res)
        self.assertIn('语文', ''.join([v['name'] for v in res['subject_stats'].values()]))

    def test_analyze_multiple_classes_ties_and_zero_students(self):
        """Ties (equal totals) and empty class should not break aggregation; empty classes can be skipped."""
        c_empty = Class.objects.create(grade_level='Gt', class_name='0班')
        c1 = Class.objects.create(grade_level='Gt', class_name='1班')
        s1 = Student.objects.create(student_id='T1', name='T1', grade_level='Gt', current_class=c1)
        s2 = Student.objects.create(student_id='T2', name='T2', grade_level='Gt', current_class=c1)

        exam = Exam.objects.create(name='E_tie', academic_year='AY', grade_level='Gt', date=date(2024, 6, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)

        # 两名学生都获得相同的总分 160
        Score.objects.create(student=s1, exam=exam, subject='语文', score_value=80)
        Score.objects.create(student=s1, exam=exam, subject='数学', score_value=80)
        Score.objects.create(student=s2, exam=exam, subject='语文', score_value=80)
        Score.objects.create(student=s2, exam=exam, subject='数学', score_value=80)

        # 调用多班级分析，包含一个空班和一个有数据的班
        res = _analyze_multiple_classes([c_empty, c1], exam)
        # total_students 应为 2
        self.assertEqual(res.get('total_students'), 2)
        # class_statistics 中至少包含有数据的班级统计
        self.assertTrue(len(res.get('class_statistics', [])) >= 1)

    def test_chart_data_json_structure_and_lengths(self):
        """Verify chart_data_json is valid JSON and arrays lengths are sensible."""
        cls = Class.objects.create(grade_level='Gc', class_name='1班')
        s = Student.objects.create(student_id='C1', name='C1', grade_level='Gc', current_class=cls)
        exam = Exam.objects.create(name='E_chart', academic_year='AY', grade_level='Gc', date=date(2024, 7, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        Score.objects.create(student=s, exam=exam, subject='语文', score_value=90)

        scores = Score.objects.filter(exam=exam, student__current_class=cls)
        res = _analyze_single_class(scores, cls, exam)
        chart_json = res.get('chart_data_json')
        parsed = json.loads(chart_json)
        self.assertIn('subject_avg_scores', parsed)
        self.assertIn('labels', parsed['subject_avg_scores'])
        self.assertIn('data', parsed['subject_avg_scores'])
        self.assertEqual(len(parsed['subject_avg_scores']['labels']), len(parsed['subject_avg_scores']['data']))

    def test_analyze_grade_handles_no_exam_subjects(self):
        """_analyze_grade 在没有任何 ExamSubject 的情况下不应抛异常并返回合理默认值。"""
        # 创建一个考试但不创建任何 ExamSubject
        exam = Exam.objects.create(name='E_no_subjects', academic_year='AY', grade_level='G_no', date=date(2024, 8, 1))
        # 创建一个班级和一个学生，但不添加成绩
        c = Class.objects.create(grade_level='G_no', class_name='1班')
        Student.objects.create(student_id='NS1', name='NoSub', grade_level='G_no', current_class=c)

        res = _analyze_grade(exam, 'G_no')
        # total_max_score 在没有 ExamSubject 时应为 0
        self.assertIn('total_max_score', res)
        self.assertEqual(res.get('total_max_score', None), 0)
        # excellent_rate 应返回 0 且函数不抛出异常
        self.assertIn('excellent_rate', res)
        self.assertEqual(res.get('excellent_rate'), 0)

    def test_analyze_single_class_and_multiple_with_no_students_or_all_missing(self):
        """当班级没有学生或学生全部缺科时，helpers 应返回默认/零值而不崩溃。"""
        # 空班级
        empty_cls = Class.objects.create(grade_level='G_empty', class_name='0班')
        exam = Exam.objects.create(name='E_empty', academic_year='AY', grade_level='G_empty', date=date(2024, 9, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)

        # 调用 single class helper，传入空的 scores queryset
        scores_empty = Score.objects.filter(exam=exam, student__current_class=empty_cls)
        res_empty = _analyze_single_class(scores_empty, empty_cls, exam)
        self.assertIn('total_students', res_empty)
        self.assertEqual(res_empty.get('total_students'), 0)

        # 多班级调用包含一个空班和一个学生但无成绩的班
        c_with_student = Class.objects.create(grade_level='G_empty', class_name='1班')
        s = Student.objects.create(student_id='MS1', name='Missing', grade_level='G_empty', current_class=c_with_student)
        # 没有为学生添加 Score
        res_multi = _analyze_multiple_classes([empty_cls, c_with_student], exam)
        # total_students 应为 0
        self.assertIn('total_students', res_multi)
        self.assertEqual(res_multi.get('total_students'), 0)

    def test_analyze_multiple_classes_chart_data_schema(self):
        """验证 _analyze_multiple_classes 生成的 chart_data_json 包含预期的键和值长度匹配。

        目标：确保前端消费的 chart schema 符合 contract（subjects/classes/class_subject_averages）。
        """
        c1 = Class.objects.create(grade_level='Gc2', class_name='1班')
        c2 = Class.objects.create(grade_level='Gc2', class_name='2班')
        s1 = Student.objects.create(student_id='X1', name='X1', grade_level='Gc2', current_class=c1)
        s2 = Student.objects.create(student_id='X2', name='X2', grade_level='Gc2', current_class=c2)

        exam = Exam.objects.create(name='E_chart_multi', academic_year='AY', grade_level='Gc2', date=date(2024, 10, 1))
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=exam, subject_code='数学', subject_name='数学', max_score=100)

        # 添加一些成绩
        Score.objects.create(student=s1, exam=exam, subject='语文', score_value=80)
        Score.objects.create(student=s2, exam=exam, subject='数学', score_value=90)

        res = _analyze_multiple_classes([c1, c2], exam)
        chart_json = res.get('chart_data_json')
        parsed = json.loads(chart_json)

        # 必须包含 key
        for key in ('subjects', 'classes', 'class_subject_averages', 'score_distributions'):
            self.assertIn(key, parsed)

        # subjects 与 classes 长度应合理匹配 class_subject_averages 的映射
        self.assertEqual(len(parsed['subjects']), 2)
        self.assertEqual(len(parsed['classes']), 2)
        self.assertEqual(len(parsed['class_subject_averages'].keys()), 2)

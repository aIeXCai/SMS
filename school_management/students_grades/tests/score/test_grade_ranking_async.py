"""Unit tests for ranking algorithm in tasks.update_grade_rankings_optimized."""
from datetime import date

from django.test import TestCase

from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score
from school_management.students_grades.tasks import update_grade_rankings_optimized


class RankingAlgorithmTests(TestCase):
    def setUp(self):
        # 建立两个班级
        self.class1 = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.class2 = Class.objects.create(grade_level='Grade8', class_name='2班')

        # 创建学生并分班
        self.s1 = Student.objects.create(student_id='A001', name='学生A', grade_level='Grade8', current_class=self.class1)
        self.s2 = Student.objects.create(student_id='A002', name='学生B', grade_level='Grade8', current_class=self.class1)
        self.s3 = Student.objects.create(student_id='A003', name='学生C', grade_level='Grade8', current_class=self.class2)
        self.s4 = Student.objects.create(student_id='A004', name='学生D', grade_level='Grade8', current_class=self.class2)

        # 创建考试与科目
        self.exam = Exam.objects.create(name='期中', academic_year='2024-2025', grade_level='Grade8', date=date(2025,6,1))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=150)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=150)

        # 添加成绩（注意设置 subject 与 exam_subject 匹配，save 会自动关联 exam_subject）
        # s1: 语文90, 数学95 -> total 185
        Score.objects.create(student=self.s1, exam=self.exam, subject='语文', score_value=90)
        Score.objects.create(student=self.s1, exam=self.exam, subject='数学', score_value=95)

        # s2: 语文95, 数学90 -> total 185 (tie with s1)
        Score.objects.create(student=self.s2, exam=self.exam, subject='语文', score_value=95)
        Score.objects.create(student=self.s2, exam=self.exam, subject='数学', score_value=90)

        # s3: 语文80, 数学80 -> total 160
        Score.objects.create(student=self.s3, exam=self.exam, subject='语文', score_value=80)
        Score.objects.create(student=self.s3, exam=self.exam, subject='数学', score_value=80)

        # s4: 语文70, 数学100 -> total 170
        Score.objects.create(student=self.s4, exam=self.exam, subject='语文', score_value=70)
        Score.objects.create(student=self.s4, exam=self.exam, subject='数学', score_value=100)

    def test_update_grade_rankings_optimized_updates_ranks_correctly(self):
        """
        测试优化后的排名更新函数是否正确计算并更新了所有相关排名字段。
        """
        # 调用优化函数
        res = update_grade_rankings_optimized(self.exam, 'Grade8')
        self.assertTrue(res.get('success'))
        # 应更新 8 条记录（4 学生 * 2 科目）
        self.assertEqual(res.get('updated_count'), 8)

        # 刷新并断言排名
        s1_scores = Score.objects.filter(student=self.s1, exam=self.exam)
        s2_scores = Score.objects.filter(student=self.s2, exam=self.exam)
        s3_scores = Score.objects.filter(student=self.s3, exam=self.exam)
        s4_scores = Score.objects.filter(student=self.s4, exam=self.exam)

        # 总分年级排名：s1 & s2 -> 1, s4 -> 3, s3 -> 4
        # 查任意一门成绩记录的 total_score_rank_in_grade 字段
        self.assertEqual(s1_scores.first().total_score_rank_in_grade, 1)
        self.assertEqual(s2_scores.first().total_score_rank_in_grade, 1)
        self.assertEqual(s4_scores.first().total_score_rank_in_grade, 3)
        self.assertEqual(s3_scores.first().total_score_rank_in_grade, 4)

        # 班级总分排名：class1 (s1,s2) both rank 1; class2: s4 rank1, s3 rank2
        self.assertEqual(s1_scores.first().total_score_rank_in_class, 1)
        self.assertEqual(s2_scores.first().total_score_rank_in_class, 1)
        self.assertEqual(s4_scores.first().total_score_rank_in_class, 1)
        self.assertEqual(s3_scores.first().total_score_rank_in_class, 2)

        # 科目年级排名 & 班级排名示例检查
        # 语文年级排名: s2(95)=1, s1(90)=2, s3(80)=3, s4(70)=4
        zyw = {sc.subject: sc for sc in Score.objects.filter(exam=self.exam, subject='语文')}
        # Find each student's 语文 score record
        rec_s1 = Score.objects.get(student=self.s1, exam=self.exam, subject='语文')
        rec_s2 = Score.objects.get(student=self.s2, exam=self.exam, subject='语文')
        rec_s3 = Score.objects.get(student=self.s3, exam=self.exam, subject='语文')
        rec_s4 = Score.objects.get(student=self.s4, exam=self.exam, subject='语文')

        self.assertEqual(rec_s2.grade_rank_in_subject, 1)
        self.assertEqual(rec_s1.grade_rank_in_subject, 2)
        self.assertEqual(rec_s3.grade_rank_in_subject, 3)
        self.assertEqual(rec_s4.grade_rank_in_subject, 4)

        # 数学年级排名: s4(100)=1, s1(95)=2, s2(90)=3, s3(80)=4
        rec_s1_m = Score.objects.get(student=self.s1, exam=self.exam, subject='数学')
        rec_s2_m = Score.objects.get(student=self.s2, exam=self.exam, subject='数学')
        rec_s3_m = Score.objects.get(student=self.s3, exam=self.exam, subject='数学')
        rec_s4_m = Score.objects.get(student=self.s4, exam=self.exam, subject='数学')

        self.assertEqual(rec_s4_m.grade_rank_in_subject, 1)
        self.assertEqual(rec_s1_m.grade_rank_in_subject, 2)
        self.assertEqual(rec_s2_m.grade_rank_in_subject, 3)
        self.assertEqual(rec_s3_m.grade_rank_in_subject, 4)

    def test_subject_ties_do_not_break_subject_ranking_order(self):
        """科目内部并列：当两名学生在同一科目并列时，他们应获得相同的科目排名，下一名的排名应跳过并列人数。

        场景说明：在 setUp 中 s2 的语文为 95，s1 为 90。这里创建一个新学生 s5，使其语文也为 95（与 s2 并列），但在另一科成绩较低以改变总分。
        期望：语文年级排名 s2 和 s5 并列为 1，s1 的语文排名应为 3（并列后跳过 2）。
        """
        # 新建一个与 s2 在语文并列但总分较低的学生
        s5 = Student.objects.create(student_id='A005', name='学生E', grade_level='Grade8', current_class=self.class1)
        # s5: 语文95 (并列), 数学 50 (使总分落后)
        Score.objects.create(student=s5, exam=self.exam, subject='语文', score_value=95)
        Score.objects.create(student=s5, exam=self.exam, subject='数学', score_value=50)

        res = update_grade_rankings_optimized(self.exam, 'Grade8')
        self.assertTrue(res.get('success'))

        # 检查语文年级排名：s2 和 s5 并列为 1，s1 应为 3
        rec_s2_ch = Score.objects.get(student=self.s2, exam=self.exam, subject='语文')
        rec_s5_ch = Score.objects.get(student=s5, exam=self.exam, subject='语文')
        rec_s1_ch = Score.objects.get(student=self.s1, exam=self.exam, subject='语文')

        self.assertEqual(rec_s2_ch.grade_rank_in_subject, 1)
        self.assertEqual(rec_s5_ch.grade_rank_in_subject, 1)
        self.assertEqual(rec_s1_ch.grade_rank_in_subject, 3)

    def test_missing_subjects_are_handled_consistently_in_total_and_ranking(self):
        """缺科/部分缺分处理：如果某学生缺少某科成绩，优化函数使用现有成绩求和(Sum)，不会把缺科视为显式0。

        期望（基于当前实现）：总分等于该学生存在的科目之和；因此缺科学生的总分通常较低，按此计算年级/班级排名。
        测试要点：创建一个只考一科的学生，断言其 total_score_rank_in_grade 排在预期位置（比有完整科目的学生低）。
        """
        # 新建一个只考语文但不考数学的学生 s6
        s6 = Student.objects.create(student_id='A006', name='学生F', grade_level='Grade8', current_class=self.class2)
        # 仅添加语文成绩 85
        Score.objects.create(student=s6, exam=self.exam, subject='语文', score_value=85)

        res = update_grade_rankings_optimized(self.exam, 'Grade8')
        self.assertTrue(res.get('success'))

        # 计算后，s6 的总分应为 85，仅按现有成绩求和。它的年级排名应低于那些有更高总分的学生。
        # 我们断言 s6 的年级名次大于或等于最低名次（即其总分不是第一）
        rec_s6_any = Score.objects.filter(student=s6, exam=self.exam).first()
        self.assertIsNotNone(rec_s6_any)
        self.assertGreaterEqual(rec_s6_any.total_score_rank_in_grade, 1)
        # 通过比较总分，可以更精确地断言：s6.total (85) 应低于 s3(160), s4(170), s1/s2(185)
        # 因此 s6 的年级排名应为 5（在原有 4 人基础上追加一名）
        self.assertEqual(rec_s6_any.total_score_rank_in_grade, 5)

    def test_class_level_and_grade_level_total_ranking_both_correct(self):
        """验证班级内与跨班级（年级）排序：每个学生应有正确的班级排名与年级排名。

        要点：向每个班级再添加一个学生，确保在班级内和年级内总分排序都按照 total_score 排序并处理并列。
        """
        # 添加两名学生，分别放到 class1 和 class2
        s7 = Student.objects.create(student_id='A007', name='学生G', grade_level='Grade8', current_class=self.class1)
        s8 = Student.objects.create(student_id='A008', name='学生H', grade_level='Grade8', current_class=self.class2)

        # s7 在 class1 给出总分 150 (例如 语文75 数学75)
        Score.objects.create(student=s7, exam=self.exam, subject='语文', score_value=75)
        Score.objects.create(student=s7, exam=self.exam, subject='数学', score_value=75)

        # s8 在 class2 给出总分 180 (例如 语文90 数学90)，应在年级排名靠前，但在 class2 内可能为 1
        Score.objects.create(student=s8, exam=self.exam, subject='语文', score_value=90)
        Score.objects.create(student=s8, exam=self.exam, subject='数学', score_value=90)

        res = update_grade_rankings_optimized(self.exam, 'Grade8')
        self.assertTrue(res.get('success'))

        # 刷新并取任意一条记录检查两个维度排名
        rec_s7 = Score.objects.filter(student=s7, exam=self.exam).first()
        rec_s8 = Score.objects.filter(student=s8, exam=self.exam).first()

        # s8 总分 180，应比 s4(170) 和 s3(160) 高，但低于 s1/s2(185)，因此年级排名应为 3
        self.assertEqual(rec_s8.total_score_rank_in_grade, 3)

        # s8 在班级 class2 中，应为该班第一（s4 total 170, s3 160）
        self.assertEqual(rec_s8.total_score_rank_in_class, 1)

        # s7 总分 150，应位于年级和班级内较靠后的位置（在 class1 内，s1/s2 有 185）
        self.assertGreater(rec_s7.total_score_rank_in_grade, rec_s8.total_score_rank_in_grade)
        # 在 class1 内，s7 的班级排名应比 s1/s2 更靠后（通常为 3）
        self.assertGreaterEqual(rec_s7.total_score_rank_in_class, 3)

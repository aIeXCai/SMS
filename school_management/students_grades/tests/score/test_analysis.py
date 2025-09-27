"""
单元测试：成绩分析 helpers

本测试模块针对 `school_management.students_grades.analysis` 中的纯计算函数进行单元测试。

目的：
- 将视图中复杂的统计逻辑抽象成可单元测试的纯函数（无数据库依赖），从而提升可维护性和可验证性。
- 覆盖常见输入、边界情况以及异常/退化场景，确保函数契约明确。

被测函数（简要说明）：
- mean_std(values): 返回平均值与样本标准差（当长度 < 2 时 stdev=0）。
- compute_distribution(values, max_score): 基于满分计算五档等级人数。
- competition_rank(values): 使用竞赛型排名规则（并列时名次相同，后续名次跳过）。
- compute_percentiles(values, percentiles): 对指定百分位点进行线性插值计算。

注：这些测试使用 Django 的 SimpleTestCase（unittest 风格），因此可通过 `manage.py test` 被自动发现并运行。
"""
from __future__ import annotations

import math

from django.test import SimpleTestCase

from school_management.students_grades import analysis


class AnalysisHelpersTests(SimpleTestCase):
    """测试集合：为每个测试方法提供目的、输入和预期行为的说明。"""

    def test_mean_std_empty(self):
        """空输入时返回安全默认值。

        输入：空列表
        预期：mean == 0.0, stdev == 0.0（避免异常/除以零）
        """
        res = analysis.mean_std([])
        self.assertEqual(res['mean'], 0.0)
        self.assertEqual(res['stdev'], 0.0)

    def test_mean_std_single_value(self):
        """单个样本时样本标准差为 0。

        输入：[42]
        预期：mean 反映输入值，stdev 为 0（没有样本方差）
        """
        res = analysis.mean_std([42])
        self.assertEqual(res['mean'], 42.0)
        self.assertEqual(res['stdev'], 0.0)

    def test_mean_std_multiple_values(self):
        """典型输入的平均值和样本标准差匹配 statistics 模块计算。

        输入：[1,2,3,4,5]
        预期：mean == 3.0；stdev 约为 1.5811（样本标准差）
        """
        res = analysis.mean_std([1, 2, 3, 4, 5])
        self.assertAlmostEqual(res['mean'], 3.0, places=6)
        # sample stdev is ~1.5811388300841898
        self.assertTrue(math.isclose(res['stdev'], 1.5811388300841898, rel_tol=1e-4))

    def test_compute_distribution_basic(self):
        """验证 compute_distribution 在正常满分场景下对五个区间的计数。

        输入：scores 对应五个不同区间，max_score=100
        预期：每个区间计数为 1
        """
        values = [95, 85, 70, 60, 59]
        buckets = analysis.compute_distribution(values, max_score=100)
        self.assertEqual(buckets['95%+'], 1)
        self.assertEqual(buckets['85-95'], 1)
        self.assertEqual(buckets['70-85'], 1)
        self.assertEqual(buckets['60-70'], 1)
        self.assertEqual(buckets['<60'], 1)

    def test_compute_distribution_zero_max(self):
        """当 max_score 为 0（或无效）时的退化处理：避免除零错误。

        该实现将所有有效分数统计到 '<60' 桶，确保函数健壮。
        """
        values = [10, 20]
        buckets = analysis.compute_distribution(values, max_score=0)
        self.assertEqual(buckets['<60'], 2)

    def test_competition_rank_ties(self):
        """验证竞赛式排名：并列项目应具有相同排名，后续排名跳过并列数量。

        输入：[95,95,90,88]
        预期：95 的名次为 1, 1；90 的名次为 3
        """
        scores = [95, 95, 90, 88]
        ranked = analysis.competition_rank(scores)
        self.assertEqual(ranked[0], (95.0, 1))
        self.assertEqual(ranked[1], (95.0, 1))
        self.assertEqual(ranked[2], (90.0, 3))

    def test_compute_percentiles_basic(self):
        """验证百分位点的线性插值实现。

        输入：[10,20,30,40]
        percentiles=[25,50,75]
        预期：25% -> 17.5, 50% -> 25.0, 75% -> 32.5
        """
        values = [10, 20, 30, 40]
        p = analysis.compute_percentiles(values, percentiles=[25, 50, 75])
        self.assertTrue(math.isclose(p[25.0], 17.5, rel_tol=1e-6))
        self.assertTrue(math.isclose(p[50.0], 25.0, rel_tol=1e-6))
        self.assertTrue(math.isclose(p[75.0], 32.5, rel_tol=1e-6))

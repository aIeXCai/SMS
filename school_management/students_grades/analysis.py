"""成绩分析帮助函数。

此模块包含一组与成绩统计相关的纯函数（不依赖 Django ORM），便于编写单元测试。

设计原则：
- 接受 Python 原生序列（例如 list[float]）作为输入。
- 对空列表行为有明确处理（返回 0、空字典或空列表，视函数而定）。
- 提供详细 docstrings，用于说明输入/输出、边界情况和示例。
"""
from __future__ import annotations

from typing import List, Dict, Iterable, Sequence, Tuple
import math
import statistics


def mean_std(values: Sequence[float]) -> Dict[str, float]:
    """计算平均值和样本标准差。

    输入:
        values: 数字序列（可以为空）

    返回:
        字典包含 'mean' 和 'stdev'。
        - 如果序列为空，mean 和 stdev 都为 0.0
        - 如果只有一个元素，stdev 返回 0.0（没有样本方差）
    """
    vals = [float(v) for v in values if v is not None]
    if not vals:
        return {"mean": 0.0, "stdev": 0.0}
    mean_val = float(statistics.mean(vals))
    if len(vals) < 2:
        return {"mean": round(mean_val, 6), "stdev": 0.0}
    # 使用样本标准差（n-1）以匹配统计学常用实现
    stdev_val = float(statistics.stdev(vals))
    return {"mean": round(mean_val, 6), "stdev": round(stdev_val, 6)}


def compute_distribution(values: Sequence[float], max_score: float) -> Dict[str, int]:
    """基于满分计算等级分布。

    分组规则与视图中使用的一致：
      - '95%+' : >= 0.95 * max_score
      - '85-95': >=0.85 & <0.95
      - '70-85': >=0.70 & <0.85
      - '60-70': >=0.60 & <0.70
      - '<60'  : <0.60

    输入:
        values: 分数序列（可以为空）
        max_score: 该考试/科目的满分（>0）

    返回:
        各等级的计数字典
    """
    buckets = {
        '95%+': 0,
        '85-95': 0,
        '70-85': 0,
        '60-70': 0,
        '<60': 0
    }
    if max_score is None or max_score <= 0:
        # 无效的满分，将所有值计入 '<60' 以保守处理
        for v in values:
            if v is None:
                continue
            buckets['<60'] += 1
        return buckets

    for v in (float(x) for x in values if x is not None):
        pct = v / max_score
        if pct >= 0.95:
            buckets['95%+'] += 1
        elif pct >= 0.85:
            buckets['85-95'] += 1
        elif pct >= 0.70:
            buckets['70-85'] += 1
        elif pct >= 0.60:
            buckets['60-70'] += 1
        else:
            buckets['<60'] += 1

    return buckets


def competition_rank(values: Sequence[float]) -> List[Tuple[float, int]]:
    """返回基于成绩的竞赛排名（standard competition ranking）。

    例如：scores = [95, 95, 90] -> ranks: [(95,1),(95,1),(90,3)]

    输入:
        values: 分数字序列（可包含相等值）。

    返回:
        按原始顺序返回 (value, rank) 列表。
    """
    # 先按值降序得到排名映射
    cleaned = [float(v) if v is not None else 0.0 for v in values]
    sorted_desc = sorted(cleaned, reverse=True)
    rank_map: Dict[float, int] = {}
    current_rank = 1
    i = 0
    while i < len(sorted_desc):
        val = sorted_desc[i]
        # 计算该值的名次（第一个出现的位置 +1）
        rank_map[val] = i + 1
        # 跳过所有相等的值
        j = i + 1
        while j < len(sorted_desc) and math.isclose(sorted_desc[j], val, rel_tol=1e-9):
            j += 1
        i = j

    # 使用原始顺序返回带排名的列表
    return [(float(v) if v is not None else 0.0, rank_map.get(float(v) if v is not None else 0.0, 0)) for v in values]


def compute_percentiles(values: Sequence[float], percentiles: Iterable[float] = (25, 50, 75)) -> Dict[float, float]:
    """计算给定分位点的值（基于排序插值）。

    参数 percentiles 为百分位数（0-100 之间）。
    返回一个 {percentile: value} 的字典。
    空输入返回空字典。
    """
    vals = sorted([float(v) for v in values if v is not None])
    if not vals:
        return {p: 0.0 for p in percentiles}

    result: Dict[float, float] = {}
    n = len(vals)
    for p in percentiles:
        if p < 0 or p > 100:
            raise ValueError('percentiles must be between 0 and 100')
        # 使用线性插值方法计算位置（百分位数的常见实现）
        k = (n - 1) * (p / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            q = vals[int(k)]
        else:
            d0 = vals[int(f)] * (c - k)
            d1 = vals[int(c)] * (k - f)
            q = d0 + d1
        result[float(p)] = float(q)

    return result

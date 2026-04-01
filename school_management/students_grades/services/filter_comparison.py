from __future__ import annotations

from django.db.models import Min

from ..models import FilterResultSnapshot, Score, Student


class FilterComparisonService:
    """筛选快照对比服务。"""

    @staticmethod
    def compare_snapshots(baseline_snapshot, comparison_snapshot) -> dict:
        """
        对比两个快照，返回新增/退出/保留学生及汇总。

        baseline_snapshot/comparison_snapshot 支持传入对象或快照 ID。
        """
        baseline = FilterComparisonService._resolve_snapshot(baseline_snapshot)
        comparison = FilterComparisonService._resolve_snapshot(comparison_snapshot)

        baseline_ids = set(FilterComparisonService._extract_student_ids(baseline))
        comparison_ids = set(FilterComparisonService._extract_student_ids(comparison))

        added_ids = sorted(comparison_ids - baseline_ids)
        removed_ids = sorted(baseline_ids - comparison_ids)
        retained_ids = sorted(baseline_ids & comparison_ids)

        all_ids = added_ids + removed_ids + retained_ids
        rank_changes = FilterComparisonService._calculate_rank_changes(
            all_ids,
            baseline.exam_id,
            comparison.exam_id,
        )

        changes = {
            "added": FilterComparisonService._build_student_entries(added_ids, rank_changes),
            "removed": FilterComparisonService._build_student_entries(removed_ids, rank_changes),
            "retained": FilterComparisonService._build_student_entries(retained_ids, rank_changes),
        }

        baseline_count = len(baseline_ids)
        retained_count = len(retained_ids)
        retention_rate = (retained_count / baseline_count * 100) if baseline_count else 0.0

        return {
            "baseline": {
                "id": baseline.id,
                "exam_name": str(baseline.exam),
                "snapshot_name": baseline.snapshot_name,
                "created_at": baseline.created_at,
            },
            "comparison": {
                "id": comparison.id,
                "exam_name": str(comparison.exam),
                "snapshot_name": comparison.snapshot_name,
                "created_at": comparison.created_at,
            },
            "changes": changes,
            "summary": {
                "added_count": len(added_ids),
                "removed_count": len(removed_ids),
                "retained_count": retained_count,
                "retention_rate": f"{retention_rate:.2f}%",
            },
        }

    @staticmethod
    def _calculate_rank_changes(student_ids: list[int], baseline_exam_id: int, comparison_exam_id: int) -> dict:
        """计算学生在两次考试间的年级总分排名变化（old_rank - new_rank）。"""
        if not student_ids:
            return {}

        students = {
            student.id: student
            for student in Student.objects.select_related("current_class").filter(id__in=student_ids)
        }

        rank_rows = (
            Score.objects.filter(student_id__in=student_ids, exam_id__in=[baseline_exam_id, comparison_exam_id])
            .values("student_id", "exam_id")
            .annotate(rank=Min("total_score_rank_in_grade"))
        )

        rank_map = {
            (row["student_id"], row["exam_id"]): row["rank"]
            for row in rank_rows
            if row["rank"] is not None
        }

        results = {}
        for student_id in student_ids:
            student = students.get(student_id)
            if not student:
                continue

            old_rank = rank_map.get((student_id, baseline_exam_id))
            new_rank = rank_map.get((student_id, comparison_exam_id))
            rank_change = (old_rank - new_rank) if (old_rank is not None and new_rank is not None) else None

            class_name = student.current_class.class_name if student.current_class else "未分班"
            results[student_id] = {
                "student_id": student.id,
                "student_number": student.student_id,
                "name": student.name,
                "class_name": class_name,
                "old_rank": old_rank,
                "new_rank": new_rank,
                "rank_change": rank_change,
            }

        return results

    @staticmethod
    def _resolve_snapshot(snapshot_or_id):
        if isinstance(snapshot_or_id, FilterResultSnapshot):
            return snapshot_or_id
        return FilterResultSnapshot.objects.select_related("exam").get(id=snapshot_or_id)

    @staticmethod
    def _extract_student_ids(snapshot: FilterResultSnapshot) -> list[int]:
        data = snapshot.result_snapshot or {}
        student_ids = data.get("student_ids") if isinstance(data, dict) else []
        if not isinstance(student_ids, list):
            return []

        normalized_ids = []
        for value in student_ids:
            try:
                normalized_ids.append(int(value))
            except (TypeError, ValueError):
                continue
        return normalized_ids

    @staticmethod
    def _build_student_entries(student_ids: list[int], rank_changes: dict) -> list[dict]:
        entries = [rank_changes[sid] for sid in student_ids if sid in rank_changes]

        def _sort_key(item: dict):
            old_rank = item.get("old_rank")
            new_rank = item.get("new_rank")
            effective_rank = new_rank if new_rank is not None else old_rank
            return (
                effective_rank if effective_rank is not None else 10**9,
                item.get("student_number") or "",
            )

        return sorted(entries, key=_sort_key)

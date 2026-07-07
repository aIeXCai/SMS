"""Business group configuration resolver."""

import json
from pathlib import Path

from ...models.student import Class

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "business_groups.json"


def load_business_groups():
    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def resolve_business_group(cohort, group_name):
    if not cohort:
        return {
            "status": "missing_cohort",
            "class_names": [],
            "class_ids": [],
            "message": f"请先确认年级或 cohort 后再查询{group_name}班。",
        }

    config = load_business_groups()
    group = config.get("groups", {}).get(cohort, {}).get(group_name)
    if not group:
        return {
            "status": "not_found",
            "class_names": [],
            "class_ids": [],
            "message": f"未找到 {cohort} 的 {group_name} 分组配置。",
        }

    class_names = group.get("class_names", [])
    if not class_names:
        return {
            "status": "empty",
            "class_names": [],
            "class_ids": [],
            "message": f"{cohort} 的 {group_name} 分组尚未维护班级。",
        }

    classes = Class.objects.filter(cohort=cohort, class_name__in=class_names).order_by("class_name", "id")
    return {
        "status": "success",
        "class_names": class_names,
        "class_ids": list(classes.values_list("id", flat=True)),
    }

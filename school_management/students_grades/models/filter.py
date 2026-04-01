from django.conf import settings
from django.db import models


class SavedFilterRule(models.Model):
    """用户保存的筛选规则。"""

    RULE_TYPE_CHOICES = [
        ("simple", "简单筛选"),
        ("advanced", "高级筛选"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_filter_rules",
        verbose_name="所属用户",
    )
    name = models.CharField(
        max_length=100,
        verbose_name="规则名称",
        help_text='如"数学培优班名单"',
    )
    rule_type = models.CharField(
        max_length=20,
        choices=RULE_TYPE_CHOICES,
        default="advanced",
        verbose_name="规则类型",
    )
    rule_config = models.JSONField(
        verbose_name="规则配置",
        help_text="筛选条件 JSON 配置",
    )
    usage_count = models.IntegerField(default=0, verbose_name="使用次数")
    last_used_at = models.DateTimeField(null=True, blank=True, verbose_name="最后使用时间")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        db_table = "saved_filter_rules"
        ordering = ["-last_used_at", "-created_at"]
        verbose_name = "保存的筛选规则"
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=["user", "-last_used_at"]),
            models.Index(fields=["rule_type"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class FilterResultSnapshot(models.Model):
    """筛选结果快照。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="filter_snapshots",
        verbose_name="所属用户",
    )
    exam = models.ForeignKey(
        "Exam",
        on_delete=models.CASCADE,
        related_name="filter_snapshots",
        verbose_name="关联考试",
    )
    rule = models.ForeignKey(
        "SavedFilterRule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="snapshots",
        verbose_name="使用的规则",
    )
    rule_config_snapshot = models.JSONField(verbose_name="规则配置快照")
    result_snapshot = models.JSONField(verbose_name="筛选结果快照")
    snapshot_name = models.CharField(
        max_length=100,
        verbose_name="快照名称",
        help_text='如"期中考试-数学培优班"',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        db_table = "filter_result_snapshots"
        ordering = ["-created_at"]
        verbose_name = "筛选结果快照"
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["exam", "-created_at"]),
            models.Index(fields=["rule", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.snapshot_name} - {self.created_at.strftime('%Y-%m-%d')}"

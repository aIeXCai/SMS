from django.contrib.auth.models import AbstractUser
from django.db import models

class Role(models.Model):
    """角色模型"""
    name = models.CharField(max_length=100, unique=True, verbose_name="角色名称")
    code = models.CharField(max_length=50, unique=True, verbose_name="角色代码")
    description = models.TextField(blank=True, verbose_name="角色描述")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "角色"
        verbose_name_plural = verbose_name

class CustomUser(AbstractUser):
    """自定义用户模型"""
    roles = models.ManyToManyField(
        Role,
        blank=True,
        related_name="users",
        verbose_name="角色"
    )
    # 你可以在这里添加更多自定义字段，例如：
    # phone_number = models.CharField(max_length=20, blank=True, verbose_name="手机号")
    # avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name="头像")

    def __str__(self):
        return self.username

    class Meta:
        verbose_name = "用户"
        verbose_name_plural = verbose_name

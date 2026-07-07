from .settings import *  # noqa

# 单元测试专用：使用项目根目录 sqlite，避免依赖外部 MySQL。
DATABASES["default"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / "db.sqlite3",
}

# 测试环境强制关闭 V3，确保 V2 回归测试不受 V3 开关影响。
AI_AGENT_V3_ENABLED = False

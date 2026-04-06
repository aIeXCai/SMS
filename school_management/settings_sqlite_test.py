from .settings import *  # noqa

# 单元测试专用：使用项目根目录 sqlite，避免依赖外部 MySQL。
DATABASES["default"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / "db.sqlite3",
}

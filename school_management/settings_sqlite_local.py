"""本地 SQLite 启动配置。

用于开发环境下通过启动脚本快速切换到 sqlite 数据库。
"""

from copy import deepcopy

from .settings import *  # noqa: F401,F403


DATABASES = deepcopy(DATABASES)
DATABASES['default'] = deepcopy(DATABASES['sqlite'])

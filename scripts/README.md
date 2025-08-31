# scripts 目录说明

本目录存放项目的运维/辅助脚本（启动、监控、状态检查、管理用户、性能调优脚本等）。目的是把日常运行和维护用的脚本集中、并提供使用说明。

注意：有些脚本依赖于项目根目录的相对路径与 Python 环境，运行前请 cd 到仓库根目录并激活相应的 Python/conda 环境。

通用前置条件
- Python 3.12+（或项目 requirements.txt 指定的版本）
- 已安装并配置好 Django（项目的 `settings.py` 可被导入）
- Redis（如果使用 django-rq）
- 推荐在项目根执行：
```bash
# 进入仓库根
cd /path/to/SMS
# 激活 conda 环境（如果使用）
conda activate sms
# 或使用 virtualenv / pipenv
```

脚本列表与说明

- `monitor_tasks.py`
  - 作用：人工运行的异步任务监控脚本，打印 django-rq 队列、查看正在执行/完成/失败的任务，并能进入 `--watch` 模式（每 5 秒刷新）。
  - 用法：
    ```bash
    python scripts/monitor_tasks.py         # 打印一次队列信息
    python scripts/monitor_tasks.py --watch # 进入轮询监控模式
    ```
  - 依赖：`django_rq`、Django 设置正确（`DJANGO_SETTINGS_MODULE=school_management.settings` 在脚本中已设置）。

- `django_status.py`
  - 作用：检查 Django 系统状态（数据库连通、基本数据计数、Redis/RQ 状态、缓存、已安装应用等），用于快速排查环境问题。
  - 用法：
    ```bash
    python scripts/django_status.py
    ```
  - 输出包含：考试/学生/成绩统计，RQ 队列摘要，cache 测试结果等。

- `manage_admin_users.py`
  - 作用：管理管理员用户的便利脚本（创建/列出/重置管理员密码等，具体用法参考脚本内部注释）。
  - 用法示例（请查看脚本顶部的帮助注释）：
    ```bash
    python scripts/manage_admin_users.py --create --username admin --email admin@example.com
    ```

* `apply_optimization.sh`（已移除）
  - 说明：该脚本已从仓库中删除或移动，历史版本可在 Git 历史中找到（例如使用 `git log --all --name-only | grep apply_optimization.sh`）。
  - 如果需要恢复，请使用 `git checkout <commit> -- path/to/apply_optimization.sh` 从历史中恢复。

* `start_server.sh`（已移除）
  - 说明：`start_server.sh` 已从仓库中删除或移动；本仓库仍保留 `start_sms.sh` 用于一键启动（见下）。
  - 如果你确实需要 `start_server.sh` 的历史版本，可以通过 Git 恢复：
    ```bash
    git log --all --pretty=format:'%h %ad %an %s' --name-only | grep start_server.sh
    git checkout <commit> -- path/to/start_server.sh
    ```
  - 注意：移动或删除脚本后，请确保 `scripts/README.md` 中的示例命令使用现有脚本（例如 `start_sms.sh`）。

其他建议与最佳实践
- 把脚本集中到 `scripts/`（本目录）是推荐做法；如果是部署相关脚本（nginx、systemd、docker），建议进一步放到 `infra/` 或 `deploy/`。
- 在 CI 或生产自动化中，如果要用这些脚本，请根据运行环境把 `conda`/`python` 路径改为绝对路径或使用容器化方式。
- 对于会修改数据或生产环境的脚本，添加 `--dry-run`/确认交互或事前备份是良好习惯。
- 若决定删除或移动脚本，请先创建分支并保留历史，避免误删导致无法回滚。

联系我们 / 维护说明
- 如果你希望我把脚本移动/改名、或把 README 纳入项目根 `README.md` 的索引中，我可以代为执行并创建一个 `chore/reorg-scripts` 分支提交变更。

——
本文件由仓库整理建议自动生成，必要时请根据团队约定补充具体的命令参数与示例。

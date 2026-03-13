# Exam 模块测试说明（详细）
# 考试模块测试说明（迁移后基线）

本目录用于验证考试模块在“前端页面 + DRF API”架构下的契约稳定性。

## 主要测试文件

- `test_exam_views.py`
  - `ExamRouteRedirectTests`：旧入口路由重定向契约（`/exams/*`）
  - `ExamApiContractSmokeTests`：`/api/exams/*` 冒烟契约（列表、选项、默认科目、创建、更新、删除）

## 测试目标

- 旧 Django 页面入口保持兼容：访问旧 URL 时跳转到前端考试页面
- 旧 `get_default_subjects/` 入口保持代理兼容：`307` 到新 API
- 新前端依赖的考试 API 主链路可用且返回结构稳定

## 运行命令

在项目根目录执行：

```bash
python manage.py test school_management.students_grades.tests.exam
```

或仅运行考试测试文件：

```bash
python manage.py test school_management.students_grades.tests.exam.test_exam_views
```
```bash
source .venv/bin/activate  # 替换为你的 venv 路径
pip install -r requirements.txt
```

三、测试文件与用例（逐项详解）

备注：下面列出的每个测试函数都位于对应的测试文件里，括号内为简短目的说明。

- test_exam_imports.py（模拟 Excel 导入相关）
  - test_exam_import_basic：模拟 Excel 行读取并按考试分组创建 Exam 与 ExamSubject，断言数量与关系。
  - test_exam_import_with_invalid_data：包含缺失字段和重复科目的导入行，断言错误被检测并不会创建重复科目。
  - test_exam_import_subject_config：测试导入时科目满分配置正确写入 `ExamSubject.max_score`。

- test_exam_forms.py（表单层单元测试）
  - test_exam_create_form_basic_fields_and_unique：验证 `ExamCreateForm` 必填字段与同学年年级下的唯一性验证。
  - test_exam_create_form_get_default_subjects：验证表单能根据年级返回默认科目及默认满分。
  - test_exam_subject_form_max_score_default_and_range：测试 `ExamSubjectForm` 的默认满分与超出范围校验。
  - test_base_exam_subject_formset_duplicate_and_min_num：测试 formset 去重逻辑与最少科目数约束。
  - test_exam_subject_form_delete_flag：验证 formset 的 `can_delete` 标志在清洗数据时被正确忽略。

- test_exam_views.py（视图与流程集成测试）
  - test_exam_list_view：考试列表页返回 200 并包含考试名称。
  - test_exam_create_step1_get_and_post：创建考试 Step1 的 GET/POST 行为（有效跳转、无效显示错误）。
  - test_exam_create_step2_get_and_post：创建考试 Step2 的 GET/POST（包括重复科目校验）；注意：测试会先提交 Step1 以设置 session。
  - test_get_default_subjects_ajax：AJAX 接口按年级返回默认科目 JSON，缺少年级参数返回 400。
  - test_exam_edit_step1_and_step2：编辑流程的 Step1/Step2，确认科目与满分能被修改。
  - test_exam_delete_view：删除考试后在数据库中不存在该考试。
  - test_exam_create_step2_no_subjects_shows_error_and_no_exam_created（高优先级）：当 Step2 没有有效科目（全部被标记删除）时不创建考试并显示错误。
  - test_exam_edit_step2_remove_subjects_removes_from_db（高优先级）：编辑时移除科目会从数据库删除相应 ExamSubject。

四、实施细节与注意事项

- 两步流程测试要先 POST Step1 为 session 写入必要数据，Step2 才能正常测试。
- formset 提交必须严格遵循 Django 的命名约定（TOTAL_FORMS/INITIAL_FORMS/MIN_NUM_FORMS 等）。
- 测试对重定向的视图使用可容忍的断言策略：如果视图在错误时 redirect 再显示消息，测试会跟随一次重定向以断言最终页面内容。

五、扩展建议（未来工作）

- 将 `test_exam_imports.py` 从内存 Excel 模拟改为调用真实导入函数（如果实现导入 API/管理命令，则转换为集成测试）。
- 增加更多边界测试：例如日期格式异常、极长描述字段、并发导入冲突、国际化（中文/英文科目名）等。

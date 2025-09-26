# Exam 模块测试说明（详细）

本文件说明 `school_management/students_grades/tests/exam` 目录下考试相关测试的目的、目录结构、如何运行以及每个测试用例的详细说明，便于维护与扩展。

目录路径：

```
school_management/students_grades/tests/exam
```

一、总体目标

- 验证 Exam、ExamSubject、以及与 Score 相关的前端表单、后端视图逻辑在常见与异常路径下的行为。
- 覆盖两步考试创建/编辑流程（Step1: 基本信息 -> Step2: 科目表单集）、AJAX 默认科目接口、以及导入模拟用例。
- 给出清晰的运行/调试步骤，以便在本地或 CI 中稳定复现。

二、如何运行测试

在项目根目录（含 `manage.py`）下：

```bash
# 运行 exam 目录下所有测试
python3 manage.py test school_management.students_grades.tests.exam -v 2

# 仅运行 views 测试
python3 manage.py test school_management.students_grades.tests.exam.test_exam_views -v 2

# 运行单个测试方法
python3 manage.py test school_management.students_grades.tests.exam.test_exam_views.ExamViewTests.test_exam_create_step2_get_and_post -v 2
```

如果在虚拟环境中，请先激活该环境并确保依赖安装完毕：

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

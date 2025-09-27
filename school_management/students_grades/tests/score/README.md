# tests/score — 每个测试文件覆盖的测试用例（逐文件详细说明）

下面列出 `school_management/students_grades/tests/score` 目录下每个测试文件的职责与具体覆盖的测试用例（便于快速定位测试覆盖范围与重构时的迁移决策）。


`__init__.py`
- 作用：将目录标记为 Python 包，确保测试发现正常。无测试用例。


`test_base.py`
- 作用：提供基础 TestCase / 工具函数供其他测试复用。
- 覆盖/提供（示例/工具，不直接验证业务逻辑）：
  - `BaseTestCase`：初始化 `self.client`，并提供可被继承的 `setUp`/`setUpTestData` 模板。
  - 常用辅助工具（例如 `ensure_list` 或小型 fixture）的实现与示例用法。


`test_ajax.py`
- 作用：验证分析页面使用的轻量 AJAX 接口的行为与边界。
- 具体测试用例：
  - `get_classes_by_grade`：
    - 返回的 JSON 包含 `classes` 列表与 `count` 字段；`count == len(classes)`。
    - 当班级名含数字时按数值顺序排序（验证 1,2,10 排序）。
    - 当班级名不含数字（如“一班”、“A班”）时仍能正常返回且计数正确。
    - 缺少 `grade_level` 参数时返回 400。
  - `get_students_by_class`：
    - 支持通过 `class_id` 查询，返回学生列表与 `count`。
    - 支持通过 `class_name` 查询（按实现约定可能为班级名或 id 字符串），返回一致结果。
    - 当缺少 `grade_level` 时返回 400；当查询不存在的 class_id 时返回空列表而非 500。
  - `get_grades_ajax`：
    - 在存在学生时返回学校中年级列表与 `count`。
    - 当没有学生时退化为返回系统默认年级列表（确保 `count >= 1`）。
  - `get_student_analysis_data`：
    - 参数验证：缺少 `student_id`、`exam_id`/`exam_ids` 返回 400；传入不存在的 exam_ids 返回 404。
    - 单 exam_id 场景：返回 `success: True`，payload 包含 `student_info`, `exams`, `trend_data`，并校验 `total_score`、`scores` 长度与趋势数据长度一致。
    - 多 exam_ids（逗号分隔）场景：能返回多个 exam 条目且 trend length 与 exams 数一致。
    - percentage 计算验证：以 `score / full_score * 100` 并四舍五入到 1 位小数。


`test_helpers.py`
- 作用：直接单元测试分析 helper（不依赖视图）以验证聚合逻辑与边界条件。
- 具体测试用例（以 `_analyze_single_class`, `_analyze_multiple_classes`, `_analyze_grade` 为目标）：
  - 单班级分析 `_analyze_single_class`：
    - 基本统计：`total_students`, `class_avg_total`, `student_rankings` 正确计算（单学生正常场景）。
    - 处理缺科/部分成绩：当部分学生缺某科时，科目平均基于现有分数计算，不抛异常。
    - 当班级没有学生或传入空的 scores queryset 时返回 `total_students == 0` 等默认/零值。
    - `chart_data_json` 是合法 JSON，且 `labels` 与 `data` 长度匹配。
  - 多班级聚合 `_analyze_multiple_classes`：
    - 返回 `class_statistics`（包含每班统计）、`subjects` 列表与 `total_students`。
    - 处理空班（跳过或合理处理）与平局（ties）情况，不影响聚合流程与计数。
    - 生成的 `chart_data_json` 包含 `subjects`, `classes`, `class_subject_averages`, `score_distributions`，并保证长度映射一致。
  - 年级级别分析 `_analyze_grade`：
    - 计算 `total_max_score`（所有 ExamSubject max_score 之和）并在无 ExamSubject 场景返回 0。
    - 计算 `excellent_rate`（例如 >=95%），在 `total_max_score == 0` 时返回 0 而不抛异常。
    - 计算 `total_students` 与其他整体指标。


`test_views_class.py`
- 作用：整合视图 `score_analysis_class` 的请求与模板渲染分支测试。
- 具体测试用例：
  - 单班级分析分支：
    - 传入单个 `selected_classes`（id）时，返回 200 并使用模板 `scores/score_analysis_class.html`。
    - context 中包含 `analysis_mode == 'single_class'`，`class_avg_total` 等基于输入数据计算的字段正确。
  - 多班级对比分支：
    - 传入多个 `selected_classes` 返回 `scores/score_analysis_class_multi.html`。
    - context 中包含 `analysis_mode == 'class_comparison'` 与 `selected_classes`（包含传入的 class）。
  - 年级整体分支（`selected_classes=all`）：
    - 返回 context 中 `total_max_score`（等于所有 ExamSubject.max_score 之和）。
  - 传入不存在 exam id 的鲁棒性测试：
    - 视图返回 200，但 `selected_exam` 不应出现在 context（并通过 messages 显示错误）。


`test_views_student.py`
- 作用：测试学生分析页面（index 与 detail）的渲染、参数过滤与错误处理。
- 具体测试用例：
  - 学生分析首页（index）：
    - 无筛选访问返回 200，渲染 `scores/score_analysis_student.html`，并包含 `students`, `exams`, `student_count` 等 context。
    - 传入 `grade_level` / `class_name`（承载 class id 的特殊约定）/`exam` 时应正确设置 `selected_exam` 与 `selected_class`。
  - 学生详情页（detail）：
    - 缺少必要参数重定向回列表页（返回 301/302）。
    - 提供完整参数时返回 200，渲染 `scores/score_analysis_student_detail.html` 并在 context 中包含 `student`, `scores`, `exams`, `subjects`。
    - 传入不存在的 `student_id` 时应重定向并显示错误（不返回 500）。


`test_analysis.py`
- 作用：对 `school_management.students_grades.analysis` 模块中纯计算函数的单元测试（不依赖 DB，使用 `SimpleTestCase`）。
- 覆盖用例：
  - `mean_std`：空列表、单值、典型多值的均值与样本标准差（stdev）计算。
  - `compute_distribution`：基于 `max_score` 将分数落到 5 个区间（95%+、85-95、70-85、60-70、<60）并统计每个桶的数量；当 `max_score == 0` 时退化到全部计入 `<60` 桶以避免除零。
  - `competition_rank`（竞赛式排名）：处理并列（ties）并保证名次跳跃（例如 1,1,3）。
  - `compute_percentiles`：对小型样本计算指定百分位（25/50/75）的插值值并验证结果。


`test_score_views_core.py`
- 作用：覆盖评分模块的核心视图（列表、添加、编辑、导出、搜索）以及批量操作与与异步队列交互的场景。
- 具体测试用例（代表性）：
  - `score_list`：基本渲染、按 `student_id` 过滤、分页/聚合数据存在性检查。
  - `score_add`（POST）：
    - 提交多科成绩创建 Score 记录并尝试 enqueue 排名更新任务（mock.patch `tasks.update_all_rankings_async`，验证 `.delay()` 被调用）。
    - 在 enqueue 抛异常（例如 Redis 不可用）时仍能保存成绩并以降级方式处理队列错误。
  - `score_edit`（POST）：更新已有 Score 并 enqueue 排名更新。
  - `score_batch_import_ajax`：
    - 上传 `.xlsx` 文件后触发 enqueue（通过 patch `django_rq.get_queue`），返回 `success` 与 `ranking_update_status` 为 `async_submitted`。
  - `search_students_ajax`：基于 query 返回匹配的学生列表（包含 student_id 与 name）。
  - 批量编辑/导出/删除（ScoreBatchEditandOpsTests）：
    - 批量编辑成功创建/更新多科成绩并 enqueue。
    - 验证验证失败时回滚（不创建任何记录）。
    - 当队列不可用仍保存成绩。
    - 批量导出/导出已选项返回 Excel（Content-Type 验证与导出内容解析检查）。
    - 批量删除（过滤/选中项）删除记录并 enqueue 排名更新；当无匹配记录时不 enqueue。


`test_score_imports.py`
- 作用：细致覆盖 Excel 批量导入场景（使用 `openpyxl` 构造内存 workbook 并 POST 上传）。
- 具体测试用例：
  - 成功导入：标准 header 与行数据应创建相应的 Score 记录并返回 `success=True` 与 `imported_count`。
  - name mismatch：学号存在但姓名不匹配时，该行被记录为错误并跳过（failed_count 增加，Score 不被创建）。
  - 非法格式（如字符串出现在分数字段）：记录错误，跳过该行，部分成功返回 `success=True` 且 `failed_count` > 0。
  - 更新已存在成绩（bulk_update）：当存在 Score 时导入应更新分数（并在 Redis 不可用时仍完成导入）。
  - 学生不存在：记录失败并不创建 Score。
  - 缺少必需列（如 '学号'）：导入失败，`imported_count == 0` 且 `success == False`。
  - 重复行/完整重复导致冲突：视为失败并回滚（`success == False` 且不创建记录）。
  - 未知科目列：被忽略且不创建记录。
  - 超过 ExamSubject.max_score 的分数：当前实现会写入超出值（说明 bulk_create 可能跳过 model.clean）；测试验证写入行为并记录该事实。


`test_score_forms.py`
- 作用：表单层验证行为测试。
- 具体测试用例：
  - `ScoreBatchUploadForm`：拒绝非 Excel 文件，接受 `.xlsx` 文件样式的 MIME/后缀。
  - `ScoreAddForm`：
    - 要求至少提供一个 score_* 字段（否则表单无效并返回非字段错误）。
    - 如果提交的成绩已存在（重复），表单应被视为无效并返回错误信息。
  - `ScoreForm`（编辑表单）：实例化时 `initial` 正确预填充字段（student, exam, subject, score_value）。


`test_grade_ranking_async.py`
- 作用：测试排名更新算法（`update_grade_rankings_optimized`）在复杂场景下的正确性。
- 具体测试用例：
  - 基本更新：对整个年级运行排名更新，返回 `success` 并更新所有相关 Score 的排名字段（`total_score_rank_in_grade`, `total_score_rank_in_class` 等）。
  - 并列（ties）处理：确认并列名次（例如 95,95 -> 两人并列名次 1，下一名为 3）。
  - 科目内排名（`grade_rank_in_subject`）与班级/年级总分排名一致性检查。
  - 缺科学生的处理：缺少某些科目学生的总分按现有科目求和，排名位次合理（通常较低）。
  - 类内与类间排名一致性：验证 class-level 与 grade-level 排名字段均被正确计算。
  - 高级场景：在并列/缺科组合场景下依旧保证排名逻辑不崩溃。
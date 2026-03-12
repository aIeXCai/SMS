# README — students_grades tests (student)

## 目的

本目录用于 Student 模块测试基线，覆盖三类契约：

1. **表单契约**（`StudentForm`）
2. **页面入口契约**（旧 Django 路由仅做重定向/代理）
3. **API 契约**（统一使用 `/api/students/*`）

> 迁移后约定：前端页面不再依赖 Django 模板渲染，测试重点从“模板与表单页面行为”转为“重定向 + API 响应结构与副作用”。

## 文件说明

- `test_student_forms.py`
  - 纯表单单元测试：字段校验、保存行为、编辑模式、边界条件。

- `test_student_imports.py`
  - 导入/模板下载 API 集成测试。
  - 目标接口：
    - `POST /api/students/batch-import/`
    - `GET /api/students/download-template/`

- `test_student_views.py`
  - 路由与 API 契约测试：
    - 旧入口重定向（如 `students/`, `students/add/`, `students/edit/<id>/`）
    - 旧模板下载入口 307 代理到 `/api/students/download-template/`
    - 新 Student API 冒烟：列表、新增、批量删除、批量改状态、批量升年级、删除触发异步排名更新。

## 运行方式

在仓库根目录执行：

```bash
python manage.py test \
  school_management.students_grades.tests.student.test_student_forms \
  school_management.students_grades.tests.student.test_student_imports \
  school_management.students_grades.tests.student.test_student_views -v 2
```

## 注意事项

- 写操作接口需要管理员或级长权限；测试中请使用 `role='admin'` 登录用户。
- 文件上传请使用 `SimpleUploadedFile` 并设置正确 `content_type`。
- 涉及异步任务（如删除后排名更新）应 `patch` 任务调度器，只断言调用路径。
- 当返回结构存在分页差异时（数组或 `results`），测试应兼容两种形态。

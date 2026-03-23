# Score 表增加 `student_grade_level_at_exam` 字段执行方案

## 一、背景与问题

### 1.1 问题描述

当前 Score 表中没有记录"学生在参加某次考试时是哪个年级"的信息。

现有字段：
- `exam.grade_level`：考试的适用年级（定义模糊：是指"考试适用于这个年级"还是"学生在参加该考试时是年级"？）

这导致目标生筛选功能无法准确获取学生的历史年级信息。

### 1.2 业务场景示例

| 场景 | 学生当前年级 | 考试时间 | exam.grade_level | 学生实际参考年级 |
|------|-------------|---------|------------------|-----------------|
| 初三学生参加初一时期末考试 | 初三 | 2023-01 | 初一 | **初一** |
| 初三学生参加初二时期中考试 | 初三 | 2023-06 | 初二 | **初二** |
| 高二学生参加高一时期末考试 | 高二 | 2022-01 | 高一 | **高一** |

### 1.3 影响范围

- 目标生筛选功能（按学生参考时年级筛选）
- 未来所有涉及"学生某次考试时是几年级"的分析功能

---

## 二、解决方案

### 2.1 方案概述

在 Score 表新增 `student_grade_level_at_exam` 字段，记录学生参加该考试时的实际年级。

### 2.2 字段设计

```python
student_grade_level_at_exam = models.CharField(
    max_length=10,
    choices=[
        ('初一', '初一'),
        ('初二', '初二'),
        ('初三', '初三'),
        ('高一', '高一'),
        ('高二', '高二'),
        ('高三', '高三'),
    ],
    null=True,
    blank=True,
    verbose_name="学生参考时年级",
    help_text="学生参加该考试时的实际年级，用于历史成绩追踪"
)
```

### 2.3 设计说明

- `null=True, blank=True`：兼容历史数据（老数据此字段可为空）
- 字段含义：学生在参加 `exam` 这场考试时，是哪个年级的学生

---

## 三、详细执行步骤

### 阶段1：数据库迁移（不可逆，建议先备份）

#### 步骤1.1：备份数据库

```bash
# 进入项目目录
cd /Users/caijinbin/Desktop/白实/信息/信息管理系统/SMS

# 备份 SQLite 数据库
cp db.sqlite3 db.sqlite3.backup_$(date +%Y%m%d_%H%M%S)
```

#### 步骤1.2：生成迁移文件

```bash
cd school_management
python manage.py makemigrations students_grades --name add_student_grade_level_at_exam
```

#### 步骤1.3：检查生成的迁移文件

```python
# 检查迁移文件内容是否正确
cat school_management/students_grades/migrations/XXXX_add_student_grade_level_at_exam.py
```

#### 步骤1.4：执行迁移

```bash
python manage.py migrate students_grades
```

---

### 阶段2：代码修改

#### 步骤2.1：修改 Score 模型

**文件**：`school_management/students_grades/models/score.py`

**修改内容**：在 Score 类的 `grade_rank_in_subject` 字段前添加新字段：

```python
class Score(models.Model):
    # ... existing fields ...

    # 新增字段：记录学生参加考试时的实际年级
    student_grade_level_at_exam = models.CharField(
        max_length=10,
        choices=[
            ('初一', '初一'),
            ('初二', '初二'),
            ('初三', '初三'),
            ('高一', '高一'),
            ('高二', '高二'),
            ('高三', '高三'),
        ],
        null=True,
        blank=True,
        verbose_name="学生参考时年级",
        help_text="学生参加该考试时的实际年级，用于历史成绩追踪"
    )

    # 保留原有字段位置不变
    grade_rank_in_subject = models.IntegerField(null=True, blank=True, verbose_name="学科年级排名")
    # ... rest of fields ...
```

#### 步骤2.2：修改 Serializer（成绩序列化器）

**文件**：`school_management/students_grades/serializers.py`

**查找**：找到 `ScoreSerializer` 类

**修改内容**：添加新字段的序列化：

```python
class ScoreSerializer(serializers.ModelSerializer):
    # ... existing fields ...

    student_grade_level_at_exam = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True
    )

    class Meta:
        model = Score
        fields = [
            # ... existing fields ...,
            'student_grade_level_at_exam',
        ]
```

#### 步骤2.3：修改后端服务逻辑（target_student_service.py）

**文件**：`school_management/students_grades/services/target_student_service.py`

**修改内容**：在查询时使用新字段过滤：

```python
# build_exam_scope 函数的查询条件中增加 student_grade_level_at_exam 条件
# 假设查询 高一学生在高一时参加的考试：

def build_exam_scope(grade_level, exam_scope):
    # ... 现有逻辑 ...

    # 新增：按学生参考时年级过滤
    # 如果需要按学生参考时年级筛选，在查询 Score 时加入
    scores_query = Score.objects.filter(
        exam__in=target_exams,
        student_grade_level_at_exam=grade_level  # 新增过滤条件
    )
```

**注意**：具体修改位置需根据目标生筛选的业务逻辑进一步确认。

#### 步骤2.4：修改批量导入逻辑

**文件**：`school_management/students_grades/services/analysis_service.py`（或批量导入相关文件）

**查找**：找到批量导入成绩的函数

**修改内容**：在导入时自动填充 `student_grade_level_at_exam` 字段

**方案**：
1. 优先使用用户导入时指定的年级
2. 如果未指定，根据学生当前年级自动推断（见步骤3.2）

#### 步骤2.5：修改前端页面

**文件**：`frontend/src/app/scores/batch-import/page.tsx`（批量导入页面）

**新增**：在导入表单中增加"学生参考时年级"字段（可选）

**文件**：`frontend/src/app/target-students/page.tsx`（目标生筛选页面）

**修改**：在查询时传递 `student_grade_level_at_exam` 参数

---

### 阶段3：历史数据处理

#### 步骤3.1：数据推算规则

对于历史数据，采用以下规则自动填充 `student_grade_level_at_exam`：

```
学生参考时年级 = 考试发生时学生的实际年级

推断逻辑：
1. 根据 Exam.academic_year（考试所在学年）
2. 根据 Student.grade_level（学生当前年级）
3. 根据 Student.class（学生所在班级）

估算公式：
学生当时年级 = 考试学年距离当前学年的差值
```

**示例**：
- 学生当前：高三（2025年）
- 考试：2023-01 高一期末考试
- 推断：学生当时是高一（因为2年前他还没上高三）

#### 步骤3.2：数据填充脚本

```python
# scripts/fill_student_grade_level_at_exam.py

import os
import sys
import django

# 设置 Django 环境
sys.path.insert(0, '/path/to/sms/school_management')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from students_grades.models import Score, Student, Exam

def fill_grade_level():
    """填充历史数据的 student_grade_level_at_exam 字段"""

    # 获取所有需要填充的记录
    scores_without_grade = Score.objects.filter(student_grade_level_at_exam__isnull=True)

    print(f"需要填充的记录数：{scores_without_grade.count()}")

    for score in scores_without_grade:
        student = score.student
        exam = score.exam

        # 推断学生当时的年级
        inferred_grade = infer_student_grade_at_exam(student, exam)

        if inferred_grade:
            score.student_grade_level_at_exam = inferred_grade
            score.save(update_fields=['student_grade_level_at_exam'])
            print(f"已填充：学生 {student.name}，考试 {exam.name}，年级 {inferred_grade}")

    print("填充完成！")


def infer_student_grade_at_exam(student, exam):
    """
    根据学生当前年级和考试时间推断学生当时的年级

    假设学制：初一→初二→初三（3年），高一→高二→高三（3年）
    """

    GRADE_SEQUENCE = ['初一', '初二', '初三', '高一', '高二', '高三']
    MIDDLE_SCHOOL_START = 0  # 初一在序列中的索引
    HIGH_SCHOOL_START = 3   # 高一在序列中的索引

    try:
        current_grade_idx = GRADE_SEQUENCE.index(student.grade_level)
    except ValueError:
        return None

    # 计算考试学年与当前学年的差值（年）
    current_year = 2025  # TODO: 动态获取当前学年
    exam_year = int(exam.academic_year.split('-')[0]) if exam.academic_year else None

    if not exam_year:
        return None

    year_diff = current_year - exam_year

    # 根据差值推算当时年级
    inferred_grade_idx = current_grade_idx - year_diff

    if 0 <= inferred_grade_idx < len(GRADE_SEQUENCE):
        return GRADE_SEQUENCE[inferred_grade_idx]

    return None


if __name__ == '__main__':
    fill_grade_level()
```

---

### 阶段4：测试验证

#### 步骤4.1：本地测试

```bash
# 1. 重启 Django 服务
python manage.py runserver

# 2. 测试 API 端点
curl -X POST http://127.0.0.1:8000/api/scores/target-students-query/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "grade_level": "高一",
    "exam_scope": {"type": "all_in_grade"},
    "metric": "total_score_rank_in_grade",
    "operator": "lte",
    "threshold": 50,
    "quantifier": "all",
    "absent_policy": "strict_fail"
  }'
```

#### 步骤4.2：检查返回数据

确认返回的 `students` 列表中，每条记录都包含 `student_grade_level_at_exam` 字段。

#### 步骤4.3：验证数据一致性

```python
# 验证脚本
python scripts/verify_student_grade_level.py
```

---

## 四、风险评估与回滚方案

### 4.1 主要风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 历史数据推断不准确 | 目标生筛选结果偏差 | 仅填充高置信度数据，低置信度留空 |
| 迁移后数据不一致 | 统计分析错误 | 充分测试，逐步灰度上线 |
| 批量导入性能下降 | 导入耗时增加 | 异步处理或批量优化 |

### 4.2 回滚方案

```bash
# 如果迁移失败，执行回滚
python manage.py migrate students_grades XXXX_previous_migration
```

### 4.3 数据校验

```sql
-- 检查是否有数据异常
SELECT student_grade_level_at_exam, COUNT(*) as cnt
FROM students_grades_score
GROUP BY student_grade_level_at_exam;

-- 检查空值比例
SELECT
  (SELECT COUNT(*) FROM students_grades_score WHERE student_grade_level_at_exam IS NOT NULL) as filled,
  (SELECT COUNT(*) FROM students_grades_score) as total;
```

---

## 五、后续优化建议

### 5.1 长期方案

1. **建立学生年级变更历史表**（StudentGradeHistory）
   - 记录每个学生的年级变更时间
   - 支持留级、转学、跳级等特殊场景

2. **修改 Exam 模型**
   - 将 `grade_level` 改名为 `applicable_grade` 或 `target_grade`
   - 明确其语义为"考试适用年级"而非"学生参考时年级"

### 5.2 短期收益

- 目标生筛选功能可正常上线
- 数据模型为未来扩展保留空间

---

## 六、执行检查清单

- [ ] 1.1 备份数据库
- [ ] 1.2 生成迁移文件
- [ ] 1.3 检查迁移文件
- [ ] 1.4 执行迁移
- [ ] 2.1 修改 Score 模型
- [ ] 2.2 修改 Serializer
- [ ] 2.3 修改后端服务逻辑
- [ ] 2.4 修改批量导入逻辑
- [ ] 2.5 修改前端页面
- [ ] 3.1 编写数据填充脚本
- [ ] 3.2 执行数据填充
- [ ] 4.1 本地测试
- [ ] 4.2 验证返回数据
- [ ] 4.3 数据一致性校验

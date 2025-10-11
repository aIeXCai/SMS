# 从各个视图模块导入视图函数
from .student_views import (
    student_list, student_add, student_edit, student_delete,
    student_update_status, student_batch_import, student_batch_delete,
    student_batch_update_status, student_batch_promote_grade,
    student_batch_graduate, download_student_import_template
)

# 未来考试和成绩视图将在这里导入
# from .exam_views import ...
# from .score_views import ...

__all__ = [
    # 学生管理视图
    'student_list', 'student_add', 'student_edit', 'student_delete',
    'student_update_status', 'student_batch_import', 'student_batch_delete',
    'student_batch_update_status', 'student_batch_promote_grade',
    'student_batch_graduate', 'download_student_import_template',
    
    # 未来的考试和成绩视图
    # 'exam_list', 'exam_add', 'exam_edit', ...
    # 'score_list', 'score_add', 'score_edit', ...
]
# Generated manually for performance optimization

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0012_score_grade_rank_in_subject_and_more'),
        ('students', '0001_initial'),
    ]

    operations = [
        # 为学生表添加学号索引
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_student_student_id ON students_student(student_id);",
            reverse_sql="DROP INDEX IF EXISTS idx_student_student_id;"
        ),
        
        # 为成绩表添加组合索引
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_score_student_exam ON exams_score(student_id, exam_id);",
            reverse_sql="DROP INDEX IF EXISTS idx_score_student_exam;"
        ),
        
        # 为成绩表添加考试-科目索引
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_score_exam_subject ON exams_score(exam_id, subject);",
            reverse_sql="DROP INDEX IF EXISTS idx_score_exam_subject;"
        ),
        
        # 为学生表添加年级索引
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_student_grade ON students_student(grade_level);",
            reverse_sql="DROP INDEX IF EXISTS idx_student_grade;"
        ),
        
        # 为成绩表添加分数值索引（用于排名查询）
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_score_value ON exams_score(score_value);",
            reverse_sql="DROP INDEX IF EXISTS idx_score_value;"
        ),
    ]

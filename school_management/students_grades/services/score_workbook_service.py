import openpyxl

from ..models.score import SUBJECT_CHOICES as SCORE_SUBJECT_CHOICES


class ScoreWorkbookService:
    """成绩导出工作簿构建服务。"""

    @staticmethod
    def build_export_workbook(rows):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "成绩导出"

        all_subjects = [subject_code for subject_code, _ in SCORE_SUBJECT_CHOICES]
        headers = ["学号", "学生姓名", "届别", "年级", "班级", "考试名称", "学年", "考试日期"] + all_subjects
        sheet.append(headers)

        for row in rows:
            output_row = [
                row['student']['student_id'],
                row['student']['name'],
                row['student']['cohort'],
                row['student']['grade_level_display'],
                row['class']['class_name'] or "N/A",
                row['exam']['name'],
                row['exam']['academic_year'] or "N/A",
                row['exam']['date'] or "",
            ]
            for subject in all_subjects:
                value = row['scores'].get(subject)
                output_row.append(value if value is not None else "-")
            sheet.append(output_row)

        return workbook

    @staticmethod
    def build_query_export_workbook(rows, all_subjects):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "成绩查询导出"

        headers = ["学号", "学生姓名", "入学级别", "年级", "班级", "考试名称", "学年", "考试日期"] + all_subjects + ["总分", "年级排名"]
        sheet.append(headers)

        for row in rows:
            output_row = [
                row['student']['student_id'],
                row['student']['name'],
                row['student']['cohort'],
                row['student']['grade_level_display'],
                row['class']['class_name'] or "N/A",
                row['exam']['name'],
                row['exam']['academic_year'] or "N/A",
                row['exam']['date'] or "",
            ]

            for subject in all_subjects:
                value = row['scores'].get(subject)
                output_row.append(value if value is not None else "-")

            output_row.append(row.get('total_score', 0))
            output_row.append(row.get('grade_rank') if row.get('grade_rank') is not None else "-")
            sheet.append(output_row)

        return workbook

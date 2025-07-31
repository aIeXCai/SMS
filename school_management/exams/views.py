from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods, require_POST
from django.db import transaction # 用於確保數據一致性
from django.db.models import Q # 用於複雜查詢篩選
from django.http import HttpResponse

import openpyxl
from datetime import datetime
import io

from .models import Exam, Score, SUBJECT_CHOICES
from .forms import ExamForm, ScoreForm, ScoreBatchUploadForm
from school_management.students.models import Student

# --- 考试管理 Views ---
# 考試列表 (Read)
def exam_list(request):
    exams = Exam.objects.all()
    return render(request, 'exams/exam_list.html', {'exams': exams})

# 新增考試 (Create)
@require_http_methods(["GET", "POST"])
def exam_add(request):
    if request.method == 'POST':
        form = ExamForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "考試新增成功！")
            return redirect('exam_list')
        else:
            messages.error(request, "新增考試失敗，請檢查表單數據。")
    else:
        form = ExamForm()
    
    return render(request, 'exams/exam_form.html', {'form': form, 'title': '新增考試'})

# 編輯考試 (Update)
@require_http_methods(["GET", "POST"])
def exam_edit(request, pk):
    exam = get_object_or_404(Exam, pk=pk)
    if request.method == 'POST':
        form = ExamForm(request.POST, instance=exam)
        if form.is_valid():
            form.save()
            messages.success(request, "考試信息更新成功！")
            return redirect('exam_list')
        else:
            messages.error(request, "更新考試信息失敗，請檢查表單數據。")
    else:
        form = ExamForm(instance=exam)
    
    return render(request, 'exams/exam_form.html', {'form': form, 'title': '編輯考試'})

# 刪除考試 (Delete)
@require_POST # 確保只接受 POST 請求以執行刪除操作
def exam_delete(request, pk):
    exam = get_object_or_404(Exam, pk=pk)
    exam.delete()
    messages.success(request, f"考試 '{exam.name}' 已成功刪除。")
    return redirect('exam_list')


# --- 成績管理 Views ---
# 成績列表 (Read)
def score_list(request):
    # 獲取所有成績記錄
    scores = Score.objects.all()

    # --- 篩選功能 ---
    # 獲取篩選參數
    student_id_filter = request.GET.get('student_id_filter')
    student_name_filter = request.GET.get('student_name_filter')
    exam_filter = request.GET.get('exam_filter')
    subject_filter = request.GET.get('subject_filter')

    # 應用篩選
    if student_id_filter:
        scores = scores.filter(student__student_id__icontains=student_id_filter)
    if student_name_filter:
        scores = scores.filter(student__name__icontains=student_name_filter)
    if exam_filter:
        scores = scores.filter(exam__pk=exam_filter) # 根據考試ID篩選
    if subject_filter:
        scores = scores.filter(subject=subject_filter)

    # 獲取所有學生和考試，用於篩選下拉選單
    students = Student.objects.all().order_by('name', 'student_id')
    exams = Exam.objects.all().order_by('-academic_year', '-date', 'name')

    context = {
        'scores': scores,
        'students': students, # 用於篩選下拉選單
        'exams': exams,       # 用於篩選下拉選單
        'subjects': SUBJECT_CHOICES, # 用於篩選下拉選單

        # 將當前選中的篩選值傳回模板，以便保持選中狀態
        'selected_student_id_filter': student_id_filter,
        'selected_student_name_filter': student_name_filter,
        'selected_exam_filter': exam_filter,
        'selected_subject_filter': subject_filter,
    }
    return render(request, 'exams/score_list.html', context)

# 新增單條成績 (Create)
@require_http_methods(["GET", "POST"])
def score_add(request):
    if request.method == 'POST':
        form = ScoreForm(request.POST)
        if form.is_valid():
            try:
                form.save()
                messages.success(request, "成绩新增成功！")
                return redirect('score_list')
            except Exception as e: # 捕獲可能的唯一性約束錯誤等
                messages.error(request, f"新增成绩失敗：{e}。请检查是否已存在该学生在该考试该科目的成绩。")
        else:
            messages.error(request, "新增成绩失敗，请检查表单数据。")
    else:
        form = ScoreForm()
    
    return render(request, 'exams/score_form.html', {'form': form, 'title': '新增成績'})

# 編輯成績 (Update)
@require_http_methods(["GET", "POST"])
def score_edit(request, pk):
    score = get_object_or_404(Score, pk=pk)
    if request.method == 'POST':
        form = ScoreForm(request.POST, instance=score)
        if form.is_valid():
            try:
                form.save()
                messages.success(request, "成绩信息更新成功！")
                return redirect('score_list')
            except Exception as e:
                messages.error(request, f"更新成绩失败：{e}。请检查是否已存在该学生在该考试该科目的成绩。")
        else:
            messages.error(request, "更新成绩信息失败，请检查表单数据。")
    else:
        form = ScoreForm(instance=score)
    
    return render(request, 'exams/score_form.html', {'form': form, 'title': '編輯成績'})

# 刪除成績 (Delete)
@require_POST
def score_delete(request, pk):
    score = get_object_or_404(Score, pk=pk)
    score.delete()
    messages.success(request, f"学生 {score.student.name} 在 {score.exam.name} 考试 {score.get_subject_display()} 科目的成绩已成功删除。")
    return redirect('score_list')

# 批量導入成績 (Excel)
@require_http_methods(["GET", "POST"])
def score_batch_import(request):
    if request.method == 'POST':
        form = ScoreBatchUploadForm(request.POST, request.FILES)
        if form.is_valid():
            excel_file = request.FILES['excel_file']
            selected_exam = form.cleaned_data['exam'] # 獲取用戶選擇的考試
            
            try:
                workbook = openpyxl.load_workbook(excel_file)
                sheet = workbook.active
                
                # 假設第一行是標題，從第二行開始讀取數據
                headers = [cell.value for cell in sheet[1]]
                
                imported_count = 0
                failed_rows = []
                
                # 預定義標準列頭（非科目列）
                fixed_headers_mapping = {
                    "学号": "student_id",
                    "学生姓名": "student_name", # 輔助信息，用於錯誤提示
                }

                # 動態識別科目列：將 SUBJECT_CHOICES 中的科目名轉換為集合，便於查找
                all_valid_subjects = {choice[0] for choice in SUBJECT_CHOICES}
                
                with transaction.atomic(): # 使用事務確保數據一致性
                    for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                        row_data = dict(zip(headers, row)) # 將行數據映射到列頭

                        student_id_from_excel = row_data.get("学号")
                        
                        errors_in_row = []
                        student_obj = None

                        # 1. 學生查找和姓名验证
                        if student_id_from_excel:
                            try:
                                student_obj = Student.objects.get(student_id=str(student_id_from_excel).strip())
                                
                                # 验证姓名是否匹配
                                student_name_from_excel = row_data.get("学生姓名")
                                if student_name_from_excel:
                                    student_name_from_excel = str(student_name_from_excel).strip()
                                    if student_obj.name != student_name_from_excel:
                                        errors_in_row.append(f"学号 '{student_id_from_excel}' 对应的学生姓名不匹配。数据库中为 '{student_obj.name}'，Excel中为 '{student_name_from_excel}'。")
                                        student_obj = None  # 设为None，跳过此学生的成绩处理
                                else:
                                    # 如果Excel中没有姓名列，给出警告但不阻止导入
                                    errors_in_row.append(f"Excel中缺少学生姓名列，无法验证学号 '{student_id_from_excel}' 的姓名匹配性。")
                                    
                            except Student.DoesNotExist:
                                errors_in_row.append(f"学号 '{student_id_from_excel}' 对应的学生不存在。")
                        else:
                            errors_in_row.append("学号不能为空。")
                        
                        # 如果學生不存在，則跳過此行所有科目成績的處理
                        if student_obj is None:
                            failed_rows.append((row_idx, row_data, "; ".join(errors_in_row)))
                            continue

                        # 2. 遍歷 Excel 列頭，動態識別科目分數
                        scores_processed_for_student = 0
                        for col_header, score_value_from_excel in row_data.items():
                            # 判斷列頭是否是一個有效科目，並且不是固定列頭
                            if col_header in all_valid_subjects:
                                current_subject = col_header # Excel 列頭就是科目名稱
                                
                                # 分數驗證與轉換
                                score_value = None
                                if score_value_from_excel is not None and str(score_value_from_excel).strip() != '': # 允許空分數單元格，表示沒有該科成績
                                    try:
                                        score_value = float(score_value_from_excel)
                                        # 可以添加分數範圍驗證，例如 0-100
                                        if not (0 <= score_value <= 100):
                                            errors_in_row.append(f"学生 '{student_obj.name}' 在 '{current_subject}' 科目的分数 '{score_value_from_excel}' 超出有效范围 (0-100)。")
                                    except ValueError:
                                        errors_in_row.append(f"学生 '{student_obj.name}' 在 '{current_subject}' 科目的分数 '{score_value_from_excel}' 格式不正確。")
                                else:
                                    # 如果分數為空，我們不處理這條成績，而是跳過
                                    # messages.info(request, f"学生 '{student_obj.name}' 在 '{current_subject}' 科目沒有分數，已跳過。")
                                    continue # 跳過空分數的科目

                                # 如果該科目有分數且通過驗證，嘗試創建或更新成績
                                if not errors_in_row: # 只有當目前行沒有錯誤時才嘗試保存
                                    try:
                                        score_obj, created = Score.objects.update_or_create(
                                            student=student_obj,
                                            exam=selected_exam,
                                            subject=current_subject,
                                            defaults={'score_value': score_value}
                                        )
                                        if created:
                                            messages.info(request, f"成功新增成绩：{student_obj.name} - {selected_exam.name} - {current_subject}: {score_value}")
                                        else:
                                            messages.info(request, f"成功更新成绩：{student_obj.name} - {selected_exam.name} - {current_subject}: {score_value}")
                                        imported_count += 1
                                        scores_processed_for_student += 1
                                    except Exception as e:
                                        # 捕獲數據庫層面的錯誤 (例如 unique_together 衝突但未被 update_or_create 處理的極端情況)
                                        errors_in_row.append(f"学生 '{student_obj.name}' 在 '{current_subject}' 科目數據庫操作失敗: {e}")
                                else:
                                    # 如果前面已經記錄了錯誤，則不嘗試保存
                                    pass
                        
                        # 記錄處理完一個學生後，該行是否還有未解決的錯誤
                        if errors_in_row:
                            failed_rows.append((row_idx, row_data, "; ".join(errors_in_row)))
                        
                        # 如果一個學生都沒有導入任何科目成績，也記錄一下
                        if scores_processed_for_student == 0 and not errors_in_row:
                            messages.warning(request, f"第 {row_idx} 行 (学生 {student_obj.name}) 未检测到任何有效科目成绩导入。")
                
                # 事務結束，如果失敗行數大於0，則顯示警告
                if imported_count > 0:
                    messages.success(request, f"成功导入 {imported_count} 条成绩数据。")
                
                if failed_rows:
                    messages.error(request, f"有 {len(failed_rows)} 行數據導入失敗，請查看下方詳情。")
                    # 將失敗數據傳遞回模板，以便顯示詳細信息
                    return render(request, 'exams/score_batch_import.html', {
                        'form': form,
                        'title': '批量導入成績',
                        'failed_rows': failed_rows,
                        'download_template_url': request.build_absolute_uri(redirect('download_score_import_template').url)
                    })
                else:
                    messages.info(request, "所有数据均已成功处理。")
                
                return redirect('score_list') # 導入後返回成績列表頁

            except Exception as e:
                messages.error(request, f"文件處理失敗或格式不正確: {e}")
        else:
            messages.error(request, "請選擇正確的 Excel 文件並選擇對應考試。")
            
    else: # GET 請求
        form = ScoreBatchUploadForm()
    
    download_template_url = request.build_absolute_uri(redirect('download_score_import_template').url)

    return render(request, 'exams/score_batch_import.html', {
        'form': form,
        'title': '批量導入成績',
        'download_template_url': download_template_url,
    })


# 下載成績導入模板
def download_score_import_template(request):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "成績導入模板"

    # 定義 Excel 表頭 (包括固定列和所有科目列)
    headers = ["学号", "学生姓名"] # 固定列
    
    # 按照 SUBJECT_CHOICES 的順序添加科目列
    for subject_name, _ in SUBJECT_CHOICES:
        headers.append(subject_name)
    
    sheet.append(headers)

    # 添加一些提示或示例數據
    # 學生 A 的語文和數學成績
    row_a = ['S001', '張三'] + [''] * len(SUBJECT_CHOICES) # 初始化空列表
    row_a[headers.index('语文')] = 85.5
    row_a[headers.index('数学')] = 92.0
    sheet.append(row_a)

    # 學生 B 的英語和物理成績
    row_b = ['S002', '李四'] + [''] * len(SUBJECT_CHOICES)
    row_b[headers.index('英语')] = 78.0
    row_b[headers.index('物理')] = 90.0
    sheet.append(row_b)

    # 添加備註和數據驗證提示
    # 可以在學號列添加提示
    sheet.cell(row=1, column=headers.index("学号") + 1).comment = openpyxl.comments.Comment("请填写学生学号，系统将通过此学号查找学生。必填。", "System")
    sheet.cell(row=1, column=headers.index("学生姓名") + 1).comment = openpyxl.comments.Comment("此列仅供参考，不参与导入判断。建议填写以方便核对。", "System")

    # 為每個科目列添加分數格式提示
    for subject_name, _ in SUBJECT_CHOICES:
        if subject_name in headers: # 確保科目在頭部列表中
            col_idx = headers.index(subject_name) + 1 # Excel 列是從 1 開始的
            sheet.cell(row=1, column=col_idx).comment = openpyxl.comments.Comment("成绩可以是整数或小数 (例如 85 或 92.5)。范围 0-100。留空表示无该科目成绩。", "System")

            # 可以在這裡添加數據驗證（雖然 openpyxl 的數據驗證比較基礎，且可能不被所有 Excel 軟體完美支持）
            # from openpyxl.worksheet.datavalidation import DataValidation
            # dv = DataValidation(type="whole", operator="between", formula1=0, formula2=100)
            # sheet.add_data_validation(dv)
            # dv.add('{}2:{}1000'.format(openpyxl.utils.get_column_letter(col_idx), openpyxl.utils.get_column_letter(col_idx)))


    excel_file = io.BytesIO()
    workbook.save(excel_file)
    excel_file.seek(0)

    response = HttpResponse(
        excel_file.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename="score_import_template_pivot.xlsx"' # 更改文件名以區分
    return response








































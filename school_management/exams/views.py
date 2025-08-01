from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods, require_POST
from django.db import transaction
from django.db.models import Sum, Count, Q, F, Case, When, IntegerField, Avg, Max, Min, Count
from django.db.models.functions import Rank
from django.core.paginator import Paginator
from django.http import HttpResponse, JsonResponse
import openpyxl
from datetime import datetime
import io
import json
from collections import defaultdict

from .models import Exam, Score, SUBJECT_CHOICES
from .forms import ExamForm, ScoreForm, ScoreBatchUploadForm, ScoreQueryForm, ScoreAddForm, ScoreAnalysisForm
from school_management.students.models import CLASS_NAME_CHOICES, Student, Class, GRADE_LEVEL_CHOICES

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
    student_id_filter = request.GET.get('student_id_filter')
    student_name_filter = request.GET.get('student_name_filter')
    exam_filter = request.GET.get('exam_filter')
    subject_filter = request.GET.get('subject_filter')
    grade_filter = request.GET.get('grade_filter')
    class_filter = request.GET.get('class_filter')

    # 應用篩選
    if student_id_filter:
        scores = scores.filter(student__student_id__icontains=student_id_filter)
    if student_name_filter:
        scores = scores.filter(student__name__icontains=student_name_filter)
    if exam_filter:
        scores = scores.filter(exam__pk=exam_filter)
    if subject_filter:
        scores = scores.filter(subject=subject_filter)
    if grade_filter:
        scores = scores.filter(student__grade_level=grade_filter)
    if class_filter:
        scores = scores.filter(student__current_class__class_name=class_filter)

    # --- 数据聚合逻辑 ---
    aggregated_data = defaultdict(lambda: {
        'student_obj': None,
        'class_obj': None,
        'exam_obj': None,
        'scores': {}
    })

    # 获取所有科目用于表头显示
    all_subjects = [choice[0] for choice in SUBJECT_CHOICES]

    # 聚合成绩数据
    for score in scores:
        key = (score.student.pk, score.exam.pk)
        
        if aggregated_data[key]['student_obj'] is None:
            aggregated_data[key]['student_obj'] = score.student
            aggregated_data[key]['class_obj'] = score.student.current_class
            aggregated_data[key]['exam_obj'] = score.exam
        
        # 将科目成绩添加到scores字典中
        aggregated_data[key]['scores'][score.subject] = score.score_value

    # 转换为列表格式供模板使用
    final_display_rows = []
    for key, data in aggregated_data.items():
        row_data_obj = type('obj', (object,), data)
        final_display_rows.append(row_data_obj)

    # 获取筛选选项数据
    students = Student.objects.all().order_by('name', 'student_id')
    exams = Exam.objects.all().order_by('-academic_year', '-date', 'name')

    context = {
        'aggregated_scores': final_display_rows,  # 模板期望的聚合数据
        'all_subjects': all_subjects,             # 所有科目列表
        'students': students,
        'exams': exams,
        'subjects': SUBJECT_CHOICES,
        'grade_levels': GRADE_LEVEL_CHOICES,
        'class_name_choices' : CLASS_NAME_CHOICES,
        
        # 保持筛选状态
        'selected_student_id_filter': student_id_filter,
        'selected_student_name_filter': student_name_filter,
        'selected_exam_filter': exam_filter,
        'selected_subject_filter': subject_filter,
        'selected_grade_filter': grade_filter,
        'selected_class_filter': class_filter,
    }
    return render(request, 'exams/score_list.html', context)

@require_http_methods(["GET", "POST"])
def score_add(request):
    if request.method == 'POST':
        form = ScoreAddForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    student = form.cleaned_data['student']
                    exam = form.cleaned_data['exam']
                    
                    created_count = 0
                    for subject_code, subject_name in SUBJECT_CHOICES:
                        score_field = f'score_{subject_code}'
                        score_value = form.cleaned_data.get(score_field)
                        
                        if score_value is not None:
                            Score.objects.create(
                                student=student,
                                exam=exam,
                                subject=subject_code,
                                score_value=score_value
                            )
                            created_count += 1
                    
                    messages.success(request, f"成功添加 {created_count} 个科目的成绩！")
                    return redirect('score_list')
            except Exception as e:
                messages.error(request, f"添加成绩失败：{e}")
        else:
            messages.error(request, "添加成绩失败，请检查表单数据。")
    else:
        form = ScoreAddForm()
    
    # Create a dictionary of score fields for easier template access
    score_fields = {}
    for subject_code, subject_name in SUBJECT_CHOICES:
        field_name = f'score_{subject_code}'
        if field_name in form.fields:
            score_fields[subject_code] = form[field_name]
    
    context = {
        'form': form,
        'title': '新增成绩',
        'subjects': SUBJECT_CHOICES,
        'score_fields': score_fields
    }
    
    return render(request, 'exams/score_form.html', context)

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
                                        if not (0 <= score_value <= 200):
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

# 批量導出筛选后的成绩
def score_batch_export(request):
    # 获取筛选参数（与score_list相同的逻辑）
    scores = Score.objects.all()
    
    student_id_filter = request.GET.get('student_id_filter')
    student_name_filter = request.GET.get('student_name_filter')
    exam_filter = request.GET.get('exam_filter')
    subject_filter = request.GET.get('subject_filter')
    grade_filter = request.GET.get('grade_filter')
    class_filter = request.GET.get('class_filter')

    # 应用相同的筛选逻辑
    if student_id_filter:
        scores = scores.filter(student__student_id__icontains=student_id_filter)
    if student_name_filter:
        scores = scores.filter(student__name__icontains=student_name_filter)
    if exam_filter:
        scores = scores.filter(exam__pk=exam_filter)
    if subject_filter:
        scores = scores.filter(subject=subject_filter)
    if grade_filter:
        scores = scores.filter(student__grade_level=grade_filter)
    if class_filter:
        scores = scores.filter(student__current_class__class_name=class_filter)
    
    # 聚合数据逻辑（与score_list相同）
    aggregated_data = defaultdict(lambda: {
        'student_obj': None,
        'class_obj': None,
        'exam_obj': None,
        'scores': {}
    })
    
    # 获取所有科目用于表头
    all_subjects = [choice[0] for choice in SUBJECT_CHOICES]
    subject_names = {choice[0]: choice[1] for choice in SUBJECT_CHOICES}
    
    # 聚合成绩数据
    for score in scores.select_related('student', 'exam', 'student__current_class'):
        key = (score.student.pk, score.exam.pk)
        
        if aggregated_data[key]['student_obj'] is None:
            aggregated_data[key]['student_obj'] = score.student
            aggregated_data[key]['class_obj'] = score.student.current_class
            aggregated_data[key]['exam_obj'] = score.exam
        
        # 将科目成绩添加到scores字典中
        aggregated_data[key]['scores'][score.subject] = score.score_value
    
    # 创建Excel文件（与上面相同的逻辑）
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "筛选成绩导出"
    
    # 设置表头
    headers = [
        "学号", "学生姓名", "年级", "班级", "考试名称", "学年", "考试日期"
    ]
    for subject_code in all_subjects:
        headers.append(subject_names[subject_code])
    
    sheet.append(headers)
    
    # 添加聚合数据
    for key, data in aggregated_data.items():
        student = data['student_obj']
        exam = data['exam_obj']
        class_obj = data['class_obj']
        scores = data['scores']
        
        row = [
            student.student_id,
            student.name,
            student.get_grade_level_display() if student.grade_level else "N/A",
            class_obj.class_name if class_obj else "N/A",
            exam.name,
            exam.academic_year or "N/A",
            exam.date.strftime('%Y-%m-%d')
        ]
        
        # 添加各科目成绩
        for subject_code in all_subjects:
            score_value = scores.get(subject_code)
            if score_value is not None:
                row.append(float(score_value))
            else:
                row.append("-")
        
        sheet.append(row)
    
    # 设置样式和列宽（与上面相同）
    base_widths = [15, 15, 10, 10, 20, 15, 12]
    subject_widths = [10] * len(all_subjects)
    column_widths = base_widths + subject_widths
    
    for i, width in enumerate(column_widths, 1):
        sheet.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width
    
    # 生成文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"筛选成绩导出_{timestamp}.xlsx"
    
    # 返回Excel文件
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    workbook.save(response)
    return response

# 批量删除筛选后的成绩
@require_POST
def score_batch_delete_filtered(request):
    # 获取筛选参数
    scores = Score.objects.all()
    
    student_id_filter = request.POST.get('student_id_filter')
    student_name_filter = request.POST.get('student_name_filter')
    exam_filter = request.POST.get('exam_filter')
    subject_filter = request.POST.get('subject_filter')
    grade_filter = request.POST.get('grade_filter')
    class_filter = request.POST.get('class_filter')

    # 应用相同的筛选逻辑
    if student_id_filter:
        scores = scores.filter(student__student_id__icontains=student_id_filter)
    if student_name_filter:
        scores = scores.filter(student__name__icontains=student_name_filter)
    if exam_filter:
        scores = scores.filter(exam__pk=exam_filter)
    if subject_filter:
        scores = scores.filter(subject=subject_filter)
    if grade_filter:
        scores = scores.filter(student__grade_level=grade_filter)
    if class_filter:
        scores = scores.filter(student__current_class__class_name=class_filter)

    # 执行删除
    count = scores.count()
    if count > 0:
        scores.delete()
        messages.success(request, f'成功删除 {count} 条成绩记录')
    else:
        messages.info(request, '没有找到符合条件的成绩记录')
    
    return redirect('score_list')


# 导出选中的成绩记录
@require_POST
def score_batch_export_selected(request):
    selected_records = request.POST.getlist('selected_records')
    
    if not selected_records:
        messages.error(request, '没有选择任何记录')
        return redirect('score_list')
    
    # 解析选中的记录并聚合数据
    aggregated_data = defaultdict(lambda: {
        'student_obj': None,
        'class_obj': None,
        'exam_obj': None,
        'scores': {}
    })
    
    # 获取所有科目用于表头
    all_subjects = [choice[0] for choice in SUBJECT_CHOICES]
    subject_names = {choice[0]: choice[1] for choice in SUBJECT_CHOICES}
    
    for record in selected_records:
        try:
            student_id, exam_id = record.split('_')
            scores = Score.objects.filter(
                student_id=student_id,
                exam_id=exam_id
            ).select_related('student', 'exam', 'student__current_class')
            
            key = (student_id, exam_id)
            
            for score in scores:
                if aggregated_data[key]['student_obj'] is None:
                    aggregated_data[key]['student_obj'] = score.student
                    aggregated_data[key]['class_obj'] = score.student.current_class
                    aggregated_data[key]['exam_obj'] = score.exam
                
                # 将科目成绩添加到scores字典中
                aggregated_data[key]['scores'][score.subject] = score.score_value
                
        except ValueError:
            continue
    
    if not aggregated_data:
        messages.error(request, '没有找到对应的成绩记录')
        return redirect('score_list')
    
    # 创建Excel文件
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "聚合成绩导出"
    
    # 设置表头 - 与页面显示一致
    headers = [
        "学号", "学生姓名", "年级", "班级", "考试名称", "学年", "考试日期"
    ]
    # 添加所有科目列
    for subject_code in all_subjects:
        headers.append(subject_names[subject_code])
    
    sheet.append(headers)
    
    # 添加聚合数据
    for key, data in aggregated_data.items():
        student = data['student_obj']
        exam = data['exam_obj']
        class_obj = data['class_obj']
        scores = data['scores']
        
        row = [
            student.student_id,
            student.name,
            student.get_grade_level_display() if student.grade_level else "N/A",
            class_obj.class_name if class_obj else "N/A",
            exam.name,
            exam.academic_year or "N/A",
            exam.date.strftime('%Y-%m-%d')
        ]
        
        # 添加各科目成绩
        for subject_code in all_subjects:
            score_value = scores.get(subject_code)
            if score_value is not None:
                row.append(float(score_value))
            else:
                row.append("-")  # 没有成绩的科目显示为 "-"
        
        sheet.append(row)
    
    # 设置列宽
    base_widths = [15, 15, 10, 10, 20, 15, 12]  # 基础信息列宽
    subject_widths = [10] * len(all_subjects)    # 科目列宽
    column_widths = base_widths + subject_widths
    
    for i, width in enumerate(column_widths, 1):
        sheet.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width
    
    # 设置表头样式
    from openpyxl.styles import Font, PatternFill, Alignment
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    # 生成文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"聚合成绩导出_{timestamp}.xlsx"
    
    # 返回Excel文件
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    workbook.save(response)
    return response

# 删除选中的成绩记录
@require_POST
def score_batch_delete_selected(request):
    selected_records = request.POST.getlist('selected_records')
    
    if not selected_records:
        messages.error(request, '没有选择任何记录')
        return redirect('score_list')
    
    # 解析选中的记录并删除
    total_deleted = 0
    for record in selected_records:
        try:
            student_id, exam_id = record.split('_')
            deleted_count = Score.objects.filter(
                student_id=student_id,
                exam_id=exam_id
            ).delete()[0]
            total_deleted += deleted_count
        except ValueError:
            continue
    
    if total_deleted > 0:
        messages.success(request, f'成功删除 {total_deleted} 条成绩记录')
    else:
        messages.info(request, '没有找到对应的成绩记录')
    
    return redirect('score_list')

# 批量编辑学生在某考试中的所有科目成绩
@require_http_methods(["GET", "POST"])
def score_batch_edit(request):
    student_id = request.GET.get('student')
    exam_id = request.GET.get('exam')
    
    if not student_id or not exam_id:
        messages.error(request, '缺少必要的参数：学生ID或考试ID')
        return redirect('score_list')
    
    try:
        student = Student.objects.get(pk=student_id)
        exam = Exam.objects.get(pk=exam_id)
    except (Student.DoesNotExist, Exam.DoesNotExist):
        messages.error(request, '学生或考试不存在')
        return redirect('score_list')
    
    if request.method == 'POST':
        # 处理表单提交
        updated_count = 0
        created_count = 0
        
        with transaction.atomic():
            for subject_code, subject_name in SUBJECT_CHOICES:
                score_value = request.POST.get(f'score_{subject_code}')
                
                if score_value and score_value.strip():  # 如果有输入分数
                    try:
                        score_value = float(score_value)
                        score_obj, created = Score.objects.update_or_create(
                            student=student,
                            exam=exam,
                            subject=subject_code,
                            defaults={'score_value': score_value}
                        )
                        if created:
                            created_count += 1
                        else:
                            updated_count += 1
                    except ValueError:
                        messages.error(request, f'{subject_name} 的分数格式不正确')
                        return render(request, 'exams/score_batch_edit.html', {
                            'student': student,
                            'exam': exam,
                            'existing_scores': get_existing_scores(student, exam),
                            'subjects': SUBJECT_CHOICES
                        })
                else:
                    # 如果分数为空，删除已存在的成绩记录
                    Score.objects.filter(
                        student=student,
                        exam=exam,
                        subject=subject_code
                    ).delete()
        
        if created_count > 0 or updated_count > 0:
            messages.success(request, f'成功保存成绩：新增 {created_count} 条，更新 {updated_count} 条')
        else:
            messages.info(request, '没有检测到任何更改')
        
        return redirect('score_list')
    
    # GET请求：显示编辑表单
    existing_scores = get_existing_scores(student, exam)
    
    context = {
        'student': student,
        'exam': exam,
        'existing_scores': existing_scores,
        'subjects': SUBJECT_CHOICES
    }
    return render(request, 'exams/score_batch_edit.html', context)

# 辅助函数：获取学生在某考试中的现有成绩
def get_existing_scores(student, exam):
    scores = Score.objects.filter(student=student, exam=exam)
    score_dict = {}
    for score in scores:
        score_dict[score.subject] = score.score_value
    return score_dict

# 成绩查询主页面
def score_query(request):
    """
    成绩查询主页面，显示查询表单
    """
    form = ScoreQueryForm()
    
    context = {
        'form': form,
        'page_title': '成绩查询',
    }
    
    return render(request, 'exams/score_query.html', context)

# 成绩查询结果页面
def score_query_results(request):
    """
    处理查询请求并显示结果，包含排名计算和科目排序
    """
    form = ScoreQueryForm(request.GET)
    results = []
    total_count = 0
    
    if form.is_valid():
        # 获取查询参数
        student_name = form.cleaned_data.get('student_name')
        student_id = form.cleaned_data.get('student_id')
        grade_level = form.cleaned_data.get('grade_level')
        class_name = form.cleaned_data.get('class_name')
        exam = form.cleaned_data.get('exam')
        academic_year = form.cleaned_data.get('academic_year')
        subject = form.cleaned_data.get('subject')
        date_from = form.cleaned_data.get('date_from')
        date_to = form.cleaned_data.get('date_to')
        sort_by = form.cleaned_data.get('sort_by')
        
        # 获取科目排序参数
        subject_sort = request.GET.get('subject_sort')
        sort_order = request.GET.get('sort_order', 'desc')  # 默认降序
        
        # 构建查询条件
        queryset = Score.objects.select_related(
            'student', 'exam', 'student__current_class'
        )
        
        # 应用筛选条件
        if student_name:
            queryset = queryset.filter(student__name__icontains=student_name)
        
        if student_id:
            queryset = queryset.filter(student__student_id__icontains=student_id)
        
        if grade_level:
            queryset = queryset.filter(student__grade_level=grade_level)
        
        if class_name:
            queryset = queryset.filter(student__current_class__class_name=class_name)
        
        if exam:
            queryset = queryset.filter(exam=exam)
        
        if academic_year:
            queryset = queryset.filter(exam__academic_year=academic_year)
        
        if subject:
            queryset = queryset.filter(subject=subject)
        
        if date_from:
            queryset = queryset.filter(exam__date__gte=date_from)
        
        if date_to:
            queryset = queryset.filter(exam__date__lte=date_to)
        
        # 聚合数据：按学生-考试组合
        results = calculate_scores_with_ranking(queryset, sort_by, subject_sort, sort_order)
        total_count = len(results)
        
        # 分页处理
        paginator = Paginator(results, 20)  # 每页20条记录
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        
        context = {
            'form': form,
            'results': page_obj,
            'total_count': total_count,
            'page_title': '查询结果',
            'has_results': True,
        }
    else:
        context = {
            'form': form,
            'page_title': '成绩查询',
            'has_results': False,
        }
    
    return render(request, 'exams/score_query_results.html', context)

# 计算成绩和排名的辅助函数
def calculate_scores_with_ranking(queryset, sort_by=None, subject_sort=None, sort_order='desc'):
    """
    计算成绩总分和年级排名，支持按科目、总分和排名排序
    """
    # 获取科目顺序
    def get_subject_order(subject_name):
        subject_dict = dict(SUBJECT_CHOICES)
        for i, (code, name) in enumerate(SUBJECT_CHOICES):
            if name == subject_name:
                return i
        return 999  # 未知科目排在最后
    
    # 聚合数据：按学生-考试组合
    student_exam_data = defaultdict(lambda: {
        'student': None,
        'exam': None,
        'class_obj': None,
        'scores': {},
        'total_score': 0,
        'subject_count': 0
    })
    
    # 收集所有科目
    all_subjects = set()
    
    for score in queryset:
        key = (score.student.pk, score.exam.pk)
        data = student_exam_data[key]
        
        # 设置基本信息
        if not data['student']:
            data['student'] = score.student
            data['exam'] = score.exam
            data['class_obj'] = score.student.current_class
        
        # 获取科目显示名称
        subject_name = dict(SUBJECT_CHOICES).get(score.subject, score.subject)
        data['scores'][subject_name] = score.score_value
        data['total_score'] += score.score_value or 0
        data['subject_count'] += 1
        all_subjects.add(subject_name)
    
    # 按SUBJECT_CHOICES顺序排列科目
    all_subjects = sorted(all_subjects, key=get_subject_order)
    
    # 转换为列表并添加排名
    results = []
    for data in student_exam_data.values():
        data['all_subjects'] = all_subjects
        results.append(data)
    
    # 计算年级排名
    grade_totals = defaultdict(list)
    for result in results:
        grade_level = result['student'].grade_level
        exam_id = result['exam'].pk
        grade_totals[(grade_level, exam_id)].append(result)
    
    # 为每个年级-考试组合计算排名
    for grade_exam_results in grade_totals.values():
        # 按总分降序排序
        grade_exam_results.sort(key=lambda x: x['total_score'], reverse=True)
        
        # 分配排名
        for rank, result in enumerate(grade_exam_results, 1):
            result['grade_rank'] = rank
    
    # 应用排序
    if subject_sort:
        reverse_order = (sort_order == 'desc')
        
        if subject_sort == 'total_score':
            # 按总分排序
            results.sort(key=lambda x: x['total_score'], reverse=reverse_order)
        elif subject_sort == 'grade_rank':
            # 按年级排名排序
            def get_rank_value(result):
                rank = result.get('grade_rank')
                return rank if rank is not None else 999  # 没有排名的排在最后
            
            results.sort(key=get_rank_value, reverse=reverse_order)
        elif subject_sort in all_subjects:
            # 按指定科目排序
            def get_subject_score(result):
                score = result['scores'].get(subject_sort)
                return score if score is not None else -1  # 没有成绩的排在最后
            
            results.sort(key=get_subject_score, reverse=reverse_order)
    elif sort_by:
        # 应用其他排序
        if sort_by == 'total_score_desc':
            results.sort(key=lambda x: x['total_score'], reverse=True)
        elif sort_by == 'total_score_asc':
            results.sort(key=lambda x: x['total_score'], reverse=False)
        elif sort_by == 'student_name':
            results.sort(key=lambda x: x['student'].name)
        elif sort_by == 'exam_date':
            results.sort(key=lambda x: x['exam'].date, reverse=True)
        elif sort_by == 'grade_rank':
            results.sort(key=lambda x: x.get('grade_rank', 999))
    
    return results

# 学生详细成绩页面
def student_score_detail(request, student_id):
    """
    显示单个学生的所有考试成绩详情
    """
    student = get_object_or_404(Student, pk=student_id)
    
    # 获取该学生的所有成绩，按考试日期降序排列
    scores = Score.objects.filter(student=student).select_related(
        'exam', 'student__current_class'
    ).order_by('-exam__date', 'subject')
    
    # 按考试分组成绩
    exam_scores = defaultdict(lambda: {
        'exam': None,
        'scores': {},
        'total_score': 0,
        'subject_count': 0,
        'grade_rank': None,
    })
    
    for score in scores:
        exam_id = score.exam.pk
        if exam_scores[exam_id]['exam'] is None:
            exam_scores[exam_id]['exam'] = score.exam
        
        exam_scores[exam_id]['scores'][score.subject] = score.score_value
        exam_scores[exam_id]['total_score'] += float(score.score_value)
        exam_scores[exam_id]['subject_count'] += 1
    
    # 计算每次考试的年级排名
    for exam_id, exam_data in exam_scores.items():
        exam = exam_data['exam']
        total_score = exam_data['total_score']
        
        # 获取同年级同考试的所有学生总分
        same_grade_scores = Score.objects.filter(
            exam=exam,
            student__grade_level=student.grade_level
        ).values('student').annotate(
            student_total=Sum('score_value')
        ).order_by('-student_total')
        
        # 计算排名
        rank = 1
        for i, score_data in enumerate(same_grade_scores):
            if score_data['student'] == student.pk:
                rank = i + 1
                break
        
        exam_scores[exam_id]['grade_rank'] = rank
        exam_scores[exam_id]['total_students'] = same_grade_scores.count()
    
    # 转换为列表格式
    exam_results = []
    for exam_id, data in exam_scores.items():
        result = type('ExamResult', (object,), {
            'exam': data['exam'],
            'scores': data['scores'],
            'total_score': data['total_score'],
            'subject_count': data['subject_count'],
            'grade_rank': data['grade_rank'],
            'total_students': data.get('total_students', 0),
            'all_subjects': sorted(set(data['scores'].keys())),
        })
        exam_results.append(result)
    
    # 按考试日期降序排列
    exam_results.sort(key=lambda x: x.exam.date, reverse=True)
    
    context = {
        'student': student,
        'exam_results': exam_results,
        'page_title': f'{student.name} 的成绩详情',
    }
    
    return render(request, 'exams/student_score_detail.html', context)

# 成绩查询结果导出
def score_query_export(request):
    """
    导出查询结果为Excel文件
    """
    # 重用查询逻辑
    from .forms import ScoreQueryForm
    
    form = ScoreQueryForm(request.GET)
    if not form.is_valid():
        messages.error(request, '查询参数无效，无法导出')
        return redirect('score_query')
    
    # 获取查询参数（与score_query_results相同的逻辑）
    student_name = form.cleaned_data.get('student_name')
    student_id = form.cleaned_data.get('student_id')
    grade_level = form.cleaned_data.get('grade_level')
    class_name = form.cleaned_data.get('class_name')
    exam = form.cleaned_data.get('exam')
    academic_year = form.cleaned_data.get('academic_year')
    subject = form.cleaned_data.get('subject')
    date_from = form.cleaned_data.get('date_from')
    date_to = form.cleaned_data.get('date_to')
    sort_by = form.cleaned_data.get('sort_by')
    
    # 构建查询条件
    queryset = Score.objects.select_related(
        'student', 'exam', 'student__current_class'
    )
    
    # 应用筛选条件
    if student_name:
        queryset = queryset.filter(student__name__icontains=student_name)
    
    if student_id:
        queryset = queryset.filter(student__student_id__icontains=student_id)
    
    if grade_level:
        queryset = queryset.filter(student__grade_level=grade_level)
    
    if class_name:
        queryset = queryset.filter(student__current_class__class_name=class_name)
    
    if exam:
        queryset = queryset.filter(exam=exam)
    
    if academic_year:
        queryset = queryset.filter(exam__academic_year=academic_year)
    
    if subject:
        queryset = queryset.filter(subject=subject)
    
    if date_from:
        queryset = queryset.filter(exam__date__gte=date_from)
    
    if date_to:
        queryset = queryset.filter(exam__date__lte=date_to)
    
    # 计算结果
    results = calculate_scores_with_ranking(queryset, sort_by)
    
    # 创建Excel文件
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "成绩查询结果"
    
    # 设置表头
    headers = [
        "学号", "学生姓名", "年级", "班级", "考试名称"
    ]
    
    # 添加科目列 - 按照SUBJECT_CHOICES顺序
    all_subjects = set()
    for result in results:
        all_subjects.update(result.all_subjects)
    
    # 按照SUBJECT_CHOICES的顺序排列科目
    def get_subject_order(subject):
        """获取科目在SUBJECT_CHOICES中的顺序"""
        for index, (choice_value, choice_display) in enumerate(SUBJECT_CHOICES):
            if choice_value == subject:
                return index
        return 999  # 如果科目不在SUBJECT_CHOICES中，放到最后
    
    ordered_subjects = sorted(all_subjects, key=get_subject_order)
    
    subject_names = dict(SUBJECT_CHOICES)
    for subject_code in ordered_subjects:
        headers.append(subject_names.get(subject_code, subject_code))
    
    # 添加总分和年级排名列
    headers.extend(["总分", "年级排名"])
    
    sheet.append(headers)
    
    # 添加数据行
    for result in results:
        row = [
            result.student.student_id,
            result.student.name,
            result.student.get_grade_level_display() if result.student.grade_level else "N/A",
            result.class_obj.class_name if result.class_obj else "N/A",
            result.exam.name,
        ]
        
        # 添加各科目成绩 - 按照SUBJECT_CHOICES顺序
        for subject_code in ordered_subjects:
            score_value = result.scores.get(subject_code, "")
            row.append(score_value)
        
        # 添加总分和年级排名
        row.append(result.total_score)
        row.append(result.grade_rank or "")
        
        sheet.append(row)
    
    # 设置列宽
    for column in sheet.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 20)
        sheet.column_dimensions[column_letter].width = adjusted_width
    
    # 生成文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"成绩查询结果_{timestamp}.xlsx"
    
    # 返回Excel文件
    excel_file = io.BytesIO()
    workbook.save(excel_file)
    excel_file.seek(0)
    
    response = HttpResponse(
        excel_file.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# --- 成绩分析 Views ---
# 成绩分析主界面
def score_analysis(request):
    form = ScoreAnalysisForm()
    
    exams = Exam.objects.all().order_by('-academic_year', '-date', 'name')
    
    # 获取所有班级数据，按年级和班级名称排序
    # 使用自定义排序来正确处理班级编号（避免'10班'排在'2班'前面的问题）
    all_classes = Class.objects.all().order_by('grade_level')
    
    # 对班级进行自定义排序，提取班级编号进行数字排序
    def extract_class_number(class_obj):
        class_name = class_obj.class_name
        # 提取班级编号，例如从'1班'中提取'1'
        import re
        match = re.search(r'(\d+)', class_name)
        return int(match.group(1)) if match else 0
    
    all_classes = sorted(all_classes, key=lambda x: (x.grade_level, extract_class_number(x)))

    context = {
        'form': form,
        'page_title': '成绩分析',
        'exams' : exams,
        'all_classes': all_classes,
    }
    
    return render(request, 'exams/score_analysis.html', context)

# 班级/年级成绩分析
def score_analysis_class(request):
    form = ScoreAnalysisForm(request.GET or None)
    
    # 检查是否从score_analysis页面传递了参数
    from_analysis_page = bool(request.GET.get('academic_year') and 
                             request.GET.get('exam') and 
                             request.GET.get('grade_level'))
    
    # 获取可选班级列表（根据年级筛选）
    available_classes = []
    if request.GET.get('grade_level'):
        available_classes = Class.objects.filter(
            grade_level=request.GET.get('grade_level')
        ).annotate(
            student_count=Count('student')
        ).order_by('class_name')
    
    # 处理从score_analysis页面传递的班级选择
    url_selected_classes = request.GET.getlist('selected_classes')
    auto_analysis = False
    
    if from_analysis_page and url_selected_classes:
        # 如果有班级选择，直接进行分析
        auto_analysis = True
        
        # 构造一个临时的form数据用于分析
        temp_form_data = {
            'academic_year': request.GET.get('academic_year'),
            'exam': request.GET.get('exam'),
            'grade_level': request.GET.get('grade_level'),
        }
        temp_form = ScoreAnalysisForm(temp_form_data)
        
        if temp_form.is_valid():
            academic_year = temp_form.cleaned_data['academic_year']
            exam = temp_form.cleaned_data['exam']
            grade_level = temp_form.cleaned_data['grade_level']
            
            # 根据传递的班级选择确定分析模式
            if 'all' in url_selected_classes:
                # 场景3：所有班级 - 年级整体分析
                analysis_mode = 'grade_overall'
                scores = Score.objects.filter(
                    exam=exam,
                    student__class_obj__grade_level=grade_level
                )
                
                context = {
                    'form': form,
                    'available_classes': available_classes,
                    'page_title': '年级整体成绩分析',
                    'analysis_type': 'class',
                    'from_analysis_page': from_analysis_page,
                    'show_class_selection': False,
                    'auto_analysis': True,
                    'analysis_mode': analysis_mode,
                    'selected_exam': exam,
                    'selected_grade': grade_level,
                    'total_students': scores.values('student').distinct().count(),
                    'total_scores': scores.count(),
                }
                return render(request, 'exams/score_analysis_class.html', context)
                
            elif len(url_selected_classes) == 1:
                # 场景1：单个班级分析
                class_id = url_selected_classes[0]
                print(f"Debug: 查找班级 - class_id: {class_id}")
                try:
                    target_class = Class.objects.get(id=class_id)
                    print(f"Debug: 找到班级 - {target_class}")
                    
                    scores = Score.objects.filter(
                        exam=exam,
                        student__class_obj=target_class
                    )
                    
                    analysis_result = _analyze_single_class(scores, target_class, exam)
                    
                    context = {
                        'form': form,
                        'available_classes': available_classes,
                        'page_title': f'{target_class.class_name} 成绩分析',
                        'analysis_type': 'class',
                        'from_analysis_page': from_analysis_page,
                        'show_class_selection': False,
                        'auto_analysis': True,
                        'analysis_mode': 'single_class',
                        'selected_exam': exam,
                        'selected_grade': grade_level,
                        'target_class': target_class,
                        **analysis_result
                    }
                    return render(request, 'exams/score_analysis_class.html', context)
                    
                except Class.DoesNotExist:
                    messages.error(request, f'班级 {class_name} 不存在')
                    
            else:
                # 场景2：多班级对比分析（暂未实现）
                messages.info(request, '多班级对比分析功能正在开发中，请选择单个班级或所有班级进行分析。')
    
    context = {
        'form': form,
        'available_classes': available_classes,
        'page_title': '班级成绩分析',
        'analysis_type': 'class',
        'from_analysis_page': from_analysis_page,
        'show_class_selection': from_analysis_page and available_classes,
        'auto_analysis': auto_analysis
    }
    
    if form.is_valid():
        academic_year = form.cleaned_data['academic_year']
        exam = form.cleaned_data['exam']
        grade_level = form.cleaned_data['grade_level']
        
        # 判断分析模式
        all_classes_selected = request.GET.get('class_selection') == 'all'
        selected_classes = form.cleaned_data.get('selected_classes', [])
        
        # 如果selected_classes为空，尝试从class_name字段获取（向后兼容）
        if not selected_classes and form.cleaned_data.get('class_name'):
            try:
                class_obj = Class.objects.get(
                    grade_level=grade_level,
                    class_name=form.cleaned_data['class_name']
                )
                selected_classes = [class_obj]
            except Class.DoesNotExist:
                selected_classes = []
        
        if all_classes_selected or not selected_classes:
            # 年级整体分析
            analysis_mode = 'grade_overall'
            analysis_scope = f"年级整体分析：{grade_level}"
            filters = {
                'exam': exam,
                'student__grade_level': grade_level,
            }
        elif len(selected_classes) == 1:
            # 单班级详细分析
            analysis_mode = 'single_class'
            target_class = selected_classes[0]
            analysis_scope = f"单班级详细分析：{target_class.grade_level}{target_class.class_name}"
            filters = {
                'exam': exam,
                'student__current_class': target_class,
            }
        else:
            # 多班级对比分析
            analysis_mode = 'class_comparison'
            class_names = [f"{c.grade_level}{c.class_name}" for c in selected_classes]
            analysis_scope = f"班级对比分析：{', '.join(class_names)}"
            filters = {
                'exam': exam,
                'student__current_class__in': selected_classes,
            }
        
        # 获取成绩数据并进行相应分析
        scores = Score.objects.filter(**filters).select_related(
            'student', 'exam', 'student__current_class'
        )
        
        # 单班级详细分析的数据处理
        if analysis_mode == 'single_class':
            analysis_data = _analyze_single_class(scores, target_class, exam)
            context.update(analysis_data)
        
        context.update({
            'scores': scores,
            'analysis_mode': analysis_mode,
            'analysis_scope': analysis_scope,
            'selected_exam': exam,
            'selected_grade': grade_level,
            'selected_classes': selected_classes,
            'academic_year': academic_year,
        })
    
    return render(request, 'exams/score_analysis_class.html', context)

# AJAX接口：根据年级获取班级列表
def get_classes_by_grade(request):
    """根据年级获取班级列表的AJAX接口"""
    from django.http import JsonResponse
    from students.models import Class
    
    grade_level = request.GET.get('grade_level')
    
    if not grade_level:
        return JsonResponse({'error': '年级参数不能为空'}, status=400)
    
    try:
        classes = Class.objects.filter(grade_level=grade_level).order_by('class_name')
        classes_data = [
            {
                'id': cls.id,
                'class_name': cls.class_name,
                'grade_level': cls.grade_level
            }
            for cls in classes
        ]
        
        return JsonResponse({
            'classes': classes_data,
            'count': len(classes_data)
        })
    except Exception as e:
        return JsonResponse({'error': f'获取班级列表失败: {str(e)}'}, status=500)

# 分析单班级详细数据
def _analyze_single_class(scores, target_class, exam):
    # 基础统计信息
    total_students = scores.values('student').distinct().count()
    
    # 按科目统计成绩
    subject_stats = {}
    score_distribution = {}
    student_scores = {}
    
    for subject_code, subject_name in SUBJECT_CHOICES:
        subject_scores = scores.filter(subject=subject_code)
        if subject_scores.exists():
            stats = subject_scores.aggregate(
                avg_score=Avg('score_value'),
                max_score=Max('score_value'),
                min_score=Min('score_value'),
                count=Count('score_value')
            )
            subject_stats[subject_code] = {
                'name': subject_name,
                'avg_score': round(float(stats['avg_score'] or 0), 2),
                'max_score': float(stats['max_score'] or 0),
                'min_score': float(stats['min_score'] or 0),
                'count': stats['count']
            }
            
            # 成绩分布统计（按分数段）
            score_ranges = {
                '90-100': subject_scores.filter(score_value__gte=90).count(),
                '80-89': subject_scores.filter(score_value__gte=80, score_value__lt=90).count(),
                '70-79': subject_scores.filter(score_value__gte=70, score_value__lt=80).count(),
                '60-69': subject_scores.filter(score_value__gte=60, score_value__lt=70).count(),
                '0-59': subject_scores.filter(score_value__lt=60).count(),
            }
            score_distribution[subject_code] = score_ranges
    
    # 学生总分排名 - 使用Django ORM聚合查询避免重复
    student_total_scores = []
    
    # 使用values和annotate来按学生分组并计算总分
    student_scores = scores.values('student__id', 'student__name').annotate(
        total_score=Sum('score_value'),
        subject_count=Count('subject')
    ).order_by('-total_score')
    
    # 转换为列表格式并添加排名
    for i, student_data in enumerate(student_scores):
        student_total_scores.append({
            'student_id': student_data['student__id'],
            'student_name': student_data['student__name'],
            'total_score': float(student_data['total_score']),
            'subject_count': student_data['subject_count'],
            'rank': i + 1
        })
    
    # 班级总体统计
    if student_total_scores:
        class_avg_total = sum([s['total_score'] for s in student_total_scores]) / len(student_total_scores)
        class_max_total = max([s['total_score'] for s in student_total_scores])
        class_min_total = min([s['total_score'] for s in student_total_scores])
    else:
        class_avg_total = class_max_total = class_min_total = 0
    
    # 准备图表数据
    chart_data = {
        'subject_avg_scores': {
            'labels': [subject_stats[code]['name'] for code in subject_stats.keys()],
            'data': [float(subject_stats[code]['avg_score']) for code in subject_stats.keys()]
        },
        'score_distribution': score_distribution,
        'student_total_scores': [{
            'student_id': s['student_id'],
            'student_name': s['student_name'],
            'total_score': float(s['total_score']),
            'subject_count': s['subject_count'],
            'rank': s['rank']
        } for s in student_total_scores[:10]]  # 只显示前10名
    }
    
    return {
        'total_students': total_students,
        'subject_stats': subject_stats,
        'score_distribution': score_distribution,
        'student_rankings': student_total_scores,
        'class_avg_total': round(class_avg_total, 2),
        'class_max_total': float(class_max_total) if class_max_total else 0,
        'class_min_total': float(class_min_total) if class_min_total else 0,
        'chart_data_json': json.dumps(chart_data, ensure_ascii=False),
        'target_class': target_class
    }

# 学生个人成绩分析
def score_analysis_student(request):
    form = ScoreAnalysisForm(request.GET or None)

    context = {
        'form': form,
        'page_title': '个人成绩分析',
        'analysis_type': 'student'
    }
    
    if form.is_valid():
        # 获取筛选条件
        academic_year = form.cleaned_data['academic_year']
        exam = form.cleaned_data['exam']
        grade_level = form.cleaned_data['grade_level']
        class_name = form.cleaned_data.get('class_name')
        
        # 构建查询条件
        filters = {
            'grade_level': grade_level,
        }
        
        if class_name:
            filters['current_class__class_name'] = class_name
        
        # 获取学生列表
        students = Student.objects.filter(**filters).order_by(
            'current_class__class_name', 'name'
        )
        
        context.update({
            'students': students,
            'selected_exam': exam,
            'selected_grade': grade_level,
            'selected_class': class_name,
            'academic_year': academic_year,
        })
    
    return render(request, 'exams/score_analysis_student.html', context)


































from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods, require_POST
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum, Count, Q, F, Case, When, IntegerField, Avg, Max, Min, Count
from django.db.models.functions import Rank
from django.core.paginator import Paginator
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
import openpyxl
from datetime import datetime
from decimal import Decimal
import io, json, statistics
from collections import defaultdict
from .models import Exam, ExamSubject, Score, SUBJECT_CHOICES, SUBJECT_DEFAULT_MAX_SCORES, ACADEMIC_YEAR_CHOICES
from .forms import ExamCreateForm, ExamSubjectFormSet, ScoreForm, ScoreBatchUploadForm, ScoreQueryForm, ScoreAddForm, ScoreAnalysisForm
from school_management.students.models import CLASS_NAME_CHOICES, Student, Class, GRADE_LEVEL_CHOICES

# <!--- 考试管理 Views --->
# 考試列表 (Read)
def exam_list(request):
    exams = Exam.objects.all()
    context = {
        'exams': exams,
        'grade_level_choices': GRADE_LEVEL_CHOICES,
        'academic_year_choices': ACADEMIC_YEAR_CHOICES,
    }
    return render(request, 'exams/exam_list.html', context)

# 两步考试创建流程
@require_http_methods(["GET", "POST"])
def exam_create_step1(request):
    """
    考试创建第一步：基本信息
    """
    if request.method == 'POST':
        form = ExamCreateForm(request.POST)
        if form.is_valid():
            # 将表单数据保存到session中
            request.session['exam_create_data'] = {
                'name': form.cleaned_data['name'],
                'academic_year': form.cleaned_data['academic_year'],
                'date': form.cleaned_data['date'].isoformat(),
                'grade_level': form.cleaned_data['grade_level'],
                'description': form.cleaned_data['description'] or '',
            }
            return redirect('exam_create_step2')
        else:
            # 收集详细的错误信息
            error_messages = []
            
            # 收集非字段错误
            if form.non_field_errors():
                for error in form.non_field_errors():
                    error_messages.append(str(error))
            
            # 收集各个字段的错误
            for field, errors in form.errors.items():
                if field != '__all__':  # 跳过非字段错误，已在上面处理
                    field_label = form.fields[field].label or field
                    for error in errors:
                        error_messages.append(f"{field_label}：{error}")
            
            # 如果没有具体错误信息，使用默认消息
            if not error_messages:
                error_messages.append("请检查表单数据。")
            
            # 将所有错误信息合并为一个详细的错误消息
            detailed_error = "考试基本信息填写有误，请修正以下问题：\n" + "\n".join([f"• {msg}" for msg in error_messages])
            messages.error(request, detailed_error)
    else:
        form = ExamCreateForm()
    
    return render(request, 'exams/exam_create_step1.html', {
        'form': form,
        'title': '创建考试 - 第1步：基本信息'
    })

@require_http_methods(["GET", "POST"])
def exam_create_step2(request):
    """
    考试创建第二步：科目配置
    """
    # 检查是否有第一步的数据
    exam_data = request.session.get('exam_create_data')
    if not exam_data:
        messages.error(request, "请先完成第一步的基本信息填写。")
        return redirect('exam_create_step1')
    
    grade_level = exam_data['grade_level']
    
    # 获取默认科目配置，传递给模板用于JavaScript初始化
    default_subjects = SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})
    default_subjects_json = json.dumps(default_subjects)
    
    if request.method == 'POST':
        formset = ExamSubjectFormSet(request.POST, grade_level=grade_level)
        if formset.is_valid():
            try:
                with transaction.atomic():
                    # 创建考试
                    exam = Exam.objects.create(
                        name=exam_data['name'],
                        academic_year=exam_data['academic_year'],
                        date=datetime.fromisoformat(exam_data['date']).date(),
                        grade_level=exam_data['grade_level'],
                        description=exam_data['description']
                    )
                    
                    # 创建考试科目
                    for form in formset:
                        if form.cleaned_data and not form.cleaned_data.get('DELETE', False):
                            ExamSubject.objects.create(
                                exam=exam,
                                subject_code=form.cleaned_data['subject_code'],
                                subject_name=form.cleaned_data['subject_code'],  # 使用科目代码作为名称
                                max_score=form.cleaned_data['max_score']
                            )
                    
                    # 清除session数据
                    del request.session['exam_create_data']
                    
                    messages.success(request, f"考试 '{exam.name}' 创建成功！")
                    return redirect('exam_list')
            except Exception as e:
                messages.error(request, f"创建考试失败：{str(e)}")
        else:
            # 收集详细的错误信息
            error_messages = []
            
            # 收集非字段错误（如重复科目等）
            if formset.non_form_errors():
                for error in formset.non_form_errors():
                    error_messages.append(str(error))
            
            # 收集各个表单的字段错误
            for i, form in enumerate(formset):
                if form.errors:
                    for field, errors in form.errors.items():
                        if field == '__all__':
                            # 非字段错误
                            for error in errors:
                                error_messages.append(f"第 {i+1} 个科目配置：{error}")
                        else:
                            # 字段错误
                            field_label = form.fields[field].label or field
                            for error in errors:
                                error_messages.append(f"第 {i+1} 个科目配置的{field_label}：{error}")
            
            # 如果没有具体错误信息，使用默认消息
            if not error_messages:
                error_messages.append("请检查科目配置数据。")
            
            # 将所有错误信息合并为一个详细的错误消息
            detailed_error = "考试创建失败，请修正以下问题：\n" + "\n".join([f"• {msg}" for msg in error_messages])
            messages.error(request, detailed_error)
    else:
        # 创建空的表单集，通过前端JavaScript动态添加默认科目
        formset = ExamSubjectFormSet(
            grade_level=grade_level
        )
    
    return render(request, 'exams/exam_create_step2.html', {
        'formset': formset,
        'exam_data': exam_data,
        'grade_level': grade_level,
        'default_subjects_json': default_subjects_json,
        'title': '创建考试 - 第2步：科目配置'
    })

@require_http_methods(["GET"])
def get_default_subjects_ajax(request):
    """
    AJAX接口：根据年级获取默认科目配置
    """
    grade_level = request.GET.get('grade_level')
    if not grade_level:
        return JsonResponse({'error': '缺少年级参数'}, status=400)
    
    default_config = SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})
    subjects_data = []
    
    for i, (subject_code, max_score) in enumerate(default_config.items()):
        subjects_data.append({
            'subject_code': subject_code,
            'subject_name': subject_code,
            'max_score': float(max_score),
            'order': i
        })
    
    return JsonResponse({
        'subjects': subjects_data,
        'grade_level': grade_level
    })

# 編輯考試 (Update)
@require_http_methods(["GET", "POST"])
def exam_edit_step1(request, pk):
    """
    考试编辑第一步：基本信息编辑
    """
    exam = get_object_or_404(Exam, pk=pk)
    
    if request.method == 'POST':
        form = ExamCreateForm(request.POST, instance=exam)
        if form.is_valid():
            # 将表单数据存储到session中
            request.session['exam_edit_data'] = {
                'exam_id': exam.id,
                'name': form.cleaned_data['name'],
                'academic_year': form.cleaned_data['academic_year'],
                'date': form.cleaned_data['date'].isoformat(),
                'grade_level': form.cleaned_data['grade_level'],
                'description': form.cleaned_data['description']
            }
            return redirect('exam_edit_step2', pk=pk)
        else:
            # 收集详细的错误信息
            error_messages = []
            
            # 收集非字段错误
            if form.non_field_errors():
                for error in form.non_field_errors():
                    error_messages.append(str(error))
            
            # 收集各个字段的错误
            for field, errors in form.errors.items():
                if field != '__all__':  # 跳过非字段错误，已在上面处理
                    field_label = form.fields[field].label or field
                    for error in errors:
                        error_messages.append(f"{field_label}：{error}")
            
            # 如果没有具体错误信息，使用默认消息
            if not error_messages:
                error_messages.append("请检查表单数据。")
            
            # 将所有错误信息合并为一个详细的错误消息
            detailed_error = "考试信息修改失败，请修正以下问题：\n" + "\n".join([f"• {msg}" for msg in error_messages])
            messages.error(request, detailed_error)
    else:
        # 使用instance参数预填充现有数据
        form = ExamCreateForm(instance=exam)
    
    return render(request, 'exams/exam_edit_step1.html', {
        'form': form,
        'exam': exam
    })

@require_http_methods(["GET", "POST"])
def exam_edit_step2(request, pk):
    """
    考试编辑第二步：科目配置编辑
    """
    exam = get_object_or_404(Exam, pk=pk)
    
    # 检查是否有第一步的数据
    exam_data = request.session.get('exam_edit_data')
    if not exam_data or exam_data['exam_id'] != exam.id:
        messages.error(request, "请先完成第一步的基本信息编辑。")
        return redirect('exam_edit_step1', pk=pk)
    
    grade_level = exam_data['grade_level']
    
    if request.method == 'POST':
        formset = ExamSubjectFormSet(request.POST, grade_level=grade_level)
        if formset.is_valid():
            try:
                with transaction.atomic():
                    # 更新考试基本信息
                    exam.name = exam_data['name']
                    exam.academic_year = exam_data['academic_year']
                    exam.date = datetime.fromisoformat(exam_data['date']).date()
                    exam.grade_level = exam_data['grade_level']
                    exam.description = exam_data['description']
                    exam.save()
                    
                    # 获取提交的科目代码列表
                    submitted_subjects = set()
                    for form in formset:
                        if form.cleaned_data:
                            submitted_subjects.add(form.cleaned_data['subject_code'])
                    
                    # 获取现有的科目代码列表
                    existing_subjects = set(exam.exam_subjects.values_list('subject_code', flat=True))
                    
                    # 删除不再需要的科目（只删除被移除的科目）
                    subjects_to_delete = existing_subjects - submitted_subjects
                    if subjects_to_delete:
                        exam.exam_subjects.filter(subject_code__in=subjects_to_delete).delete()
                    
                    # 更新或创建科目配置
                    for form in formset:
                        if form.cleaned_data:
                            subject_code = form.cleaned_data['subject_code']
                            max_score = form.cleaned_data['max_score']
                            
                            # 更新现有科目或创建新科目
                            exam_subject, created = ExamSubject.objects.update_or_create(
                                exam=exam,
                                subject_code=subject_code,
                                defaults={'max_score': max_score}
                            )
                    
                    # 清除session数据
                    if 'exam_edit_data' in request.session:
                        del request.session['exam_edit_data']
                    
                    messages.success(request, f"考试 '{exam.name}' 更新成功！")
                    return redirect('exam_list')
            except Exception as e:
                messages.error(request, f"更新考试失败：{str(e)}")
        else:
            # 收集详细的错误信息
            error_messages = []
            
            # 收集非字段错误（如重复科目等）
            if formset.non_form_errors():
                for error in formset.non_form_errors():
                    error_messages.append(str(error))
            
            # 收集各个表单的字段错误
            for i, form in enumerate(formset):
                if form.errors:
                    for field, errors in form.errors.items():
                        if field == '__all__':
                            # 非字段错误
                            for error in errors:
                                error_messages.append(f"第 {i+1} 个科目配置：{error}")
                        else:
                            # 字段错误
                            field_label = form.fields[field].label or field
                            for error in errors:
                                error_messages.append(f"第 {i+1} 个科目配置的{field_label}：{error}")
            
            # 如果没有具体错误信息，使用默认消息
            if not error_messages:
                error_messages.append("请检查科目配置数据。")
            
            # 将所有错误信息合并为一个详细的错误消息
            detailed_error = "考试更新失败，请修正以下问题：\n" + "\n".join([f"• {msg}" for msg in error_messages])
            messages.error(request, detailed_error)
            # 表单验证失败时，保持用户提交的数据，不重新加载数据库数据
    else:
        # 预填充现有科目数据，按照SUBJECT_CHOICES的顺序排列
        existing_subjects = exam.exam_subjects.all()
        
        # 创建科目顺序映射字典
        subject_order = {choice[0]: index for index, choice in enumerate(SUBJECT_CHOICES)}
        
        # 按照SUBJECT_CHOICES的顺序对现有科目进行排序
        sorted_subjects = sorted(existing_subjects, key=lambda x: subject_order.get(x.subject_code, 999))
        
        initial_data = []
        for subject in sorted_subjects:
            initial_data.append({
                'subject_code': subject.subject_code,
                'max_score': subject.max_score
            })
        
        formset = ExamSubjectFormSet(initial=initial_data, grade_level=grade_level)
    
    # 获取默认科目配置，传递给模板用于JavaScript初始化
    default_subjects = SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})
    default_subjects_json = json.dumps(default_subjects)
    
    return render(request, 'exams/exam_edit_step2.html', {
        'formset': formset,
        'exam_data': exam_data,
        'exam': exam,
        'default_subjects_json': default_subjects_json
    })

# 刪除考試 (Delete)
@require_POST # 確保只接受 POST 請求以執行刪除操作
def exam_delete(request, pk):
    exam = get_object_or_404(Exam, pk=pk)
    exam.delete()
    messages.success(request, f"考試 '{exam.name}' 已成功刪除。")
    return redirect('exam_list')


# 更新指定考试的年级排名
# 如果指定了grade_level，只更新该年级的排名
# 如果没有指定，更新该考试所有年级的排名
def update_grade_rankings(exam_id, grade_level=None):
    exam = get_object_or_404(Exam, pk=exam_id)
    
    # 获取需要更新排名的年级
    if grade_level:
        grade_levels = [grade_level]
    else:
        # 获取该考试涉及的所有年级
        grade_levels = Score.objects.filter(exam=exam).values_list(
            'student__grade_level', flat=True
        ).distinct()
    
    for current_grade in grade_levels:
        # 获取该年级该考试的所有学生成绩
        students_scores = Score.objects.filter(
            exam=exam,
            student__grade_level=current_grade
        ).values(
            'student_id',
            'student__name'
        ).annotate(
            total_score=Sum('score_value')
        ).order_by('-total_score')
        
        # 正确的排名逻辑：处理并列排名
        current_rank = 1
        previous_score = None
        students_with_same_rank = 0
        
        for i, student_data in enumerate(students_scores):
            student_id = student_data['student_id']
            total_score = float(student_data['total_score'])
            
            # 如果当前分数与前一个分数不同，更新排名
            if previous_score is not None and total_score != previous_score:
                current_rank = i + 1  # 跳过并列的位次
            
            # 更新该学生在该考试中所有科目的排名
            Score.objects.filter(
                exam=exam,
                student_id=student_id
            ).update(total_score_rank_in_grade=current_rank)
            
            previous_score = total_score


# --- 成績管理 Views ---
# 成績列表 (Read)
def score_list(request):
    # 获取筛选参数
    student_id_filter = request.GET.get('student_id_filter')
    student_name_filter = request.GET.get('student_name_filter')
    exam_filter = request.GET.get('exam_filter')
    subject_filter = request.GET.get('subject_filter')
    grade_filter = request.GET.get('grade_filter')
    class_filter = request.GET.get('class_filter')
    
    # 优化查询：使用select_related减少数据库查询次数
    scores = Score.objects.select_related(
        'student', 
        'student__current_class', 
        'exam'
    ).order_by('student__student_id', 'exam__date', 'subject')

    # 应用筛选
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

    # --- 优化的数据聚合逻辑 ---
    # 限制查询结果数量，避免内存溢出
    scores = scores[:2000]  # 限制最多处理2000条记录
    
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

    # 添加分页功能
    paginator = Paginator(final_display_rows, 50)  # 每页显示50条记录
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # 获取筛选选项数据（优化查询）
    # 只获取有成绩记录的学生，避免加载所有学生数据
    students = Student.objects.filter(
        pk__in=Score.objects.values_list('student_id', flat=True).distinct()
    ).select_related('current_class').order_by('name', 'student_id')[:100]  # 限制数量
    
    # 获取所有考试用于批量导入功能，按时间倒序排列
    exams = Exam.objects.all().order_by('-academic_year', '-date', 'name')[:100]  # 适当限制数量

    context = {
        'aggregated_scores': page_obj,  # 使用分页对象
        'all_subjects': all_subjects,   # 所有科目列表
        'students': students,
        'exams': exams,
        'subjects': SUBJECT_CHOICES,
        'grade_levels': GRADE_LEVEL_CHOICES,
        'class_name_choices': CLASS_NAME_CHOICES,
        
        # 分页信息
        'page_obj': page_obj,
        'is_paginated': page_obj.has_other_pages(),
        
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
                    
                    # 添加排名更新逻辑
                    try:
                        update_grade_rankings(exam.pk, student.grade_level)
                        messages.success(request, f"成功添加 {created_count} 个科目的成绩，并已更新年级排名！")
                    except Exception as e:
                        messages.warning(request, f'成绩添加成功，但排名更新失败: {e}')
                    
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
                updated_score = form.save()
                messages.success(request, "成绩信息更新成功！")
                
                # 更新年级排名
                try:
                    update_grade_rankings(updated_score.exam.pk, updated_score.student.grade_level)
                except Exception as e:
                    messages.warning(request, f'成绩更新成功，但排名更新失败: {e}')
                    
                return redirect('score_list')
            except Exception as e:
                messages.error(request, f"更新成绩失败：{e}。请检查是否已存在该学生在该考试该科目的成绩。")
        else:
            messages.error(request, "更新成绩信息失败，请检查表单数据。")
    else:
        form = ScoreForm(instance=score)
    
    return render(request, 'exams/score_form.html', {'form': form, 'title': '編輯成績'})

# 批量導入成績 (Excel) - AJAX版本
@require_POST
def score_batch_import_ajax(request):
    """AJAX批量导入成绩接口"""
    try:
        form = ScoreBatchUploadForm(request.POST, request.FILES)
        if not form.is_valid():
            return JsonResponse({
                'success': False,
                'message': '表单验证失败，请检查文件格式和考试选择。',
                'errors': form.errors
            })
        
        excel_file = request.FILES['excel_file']
        selected_exam = form.cleaned_data['exam']
        
        workbook = openpyxl.load_workbook(excel_file)
        sheet = workbook.active
        headers = [cell.value for cell in sheet[1]]
        
        imported_count = 0
        failed_count = 0
        error_details = []  # 收集详细错误信息
        successful_students = set()  # 跟踪成功导入的学生
        failed_students = set()  # 跟踪失败的学生
        
        # 預定義標準列頭（非科目列）
        fixed_headers_mapping = {
            "学号": "student_id",
            "学生姓名": "student_name",
        }
        
        # 動態識別科目列
        all_valid_subjects = {choice[0] for choice in SUBJECT_CHOICES}
        
        with transaction.atomic():
            for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                row_data = dict(zip(headers, row))
                student_id_from_excel = row_data.get("学号")
                
                errors_in_row = []
                student_obj = None
                
                # 學生查找和姓名验证
                if student_id_from_excel:
                    try:
                        student_obj = Student.objects.get(student_id=str(student_id_from_excel).strip())
                        
                        # 验证姓名是否匹配
                        student_name_from_excel = row_data.get("学生姓名")
                        if student_name_from_excel:
                            student_name_from_excel = str(student_name_from_excel).strip()
                            if student_obj.name != student_name_from_excel:
                                errors_in_row.append(f"学号 '{student_id_from_excel}' 对应的学生姓名不匹配")
                                student_obj = None
                                
                    except Student.DoesNotExist:
                        errors_in_row.append(f"学号 '{student_id_from_excel}' 对应的学生不存在")
                else:
                    errors_in_row.append("学号不能为空")
                
                # 如果學生不存在，則跳過此行
                if student_obj is None:
                    if student_id_from_excel:
                        failed_students.add(student_id_from_excel)
                    continue
                
                # 遍歷科目分數
                scores_processed_for_student = 0
                for col_header, score_value_from_excel in row_data.items():
                    if col_header in all_valid_subjects:
                        current_subject = col_header
                        
                        # 分數驗證與轉換
                        if score_value_from_excel is not None and str(score_value_from_excel).strip() != '':
                            try:
                                score_value = float(score_value_from_excel)
                                if not (0 <= score_value <= 200):
                                    errors_in_row.append(f"分数超出有效范围")
                                    continue
                            except ValueError:
                                errors_in_row.append(f"分数格式不正确")
                                continue
                        else:
                            continue
                        
                        # 保存成績
                        if not errors_in_row:
                            try:
                                score_obj, created = Score.objects.update_or_create(
                                    student=student_obj,
                                    exam=selected_exam,
                                    subject=current_subject,
                                    defaults={'score_value': score_value}
                                )
                                scores_processed_for_student += 1
                                successful_students.add(student_obj.student_id)
                            except Exception as e:
                                errors_in_row.append(f"数据库操作失败: {str(e)}")
                
                # 記錄失敗行
                if errors_in_row:
                    if student_id_from_excel:
                        failed_students.add(student_id_from_excel)
                    error_details.append({
                        'row': row_idx,
                        'student_id': student_id_from_excel,
                        'student_name': row_data.get("学生姓名", ''),
                        'errors': errors_in_row
                    })
        
        # 计算最终的学生数量统计
        imported_count = len(successful_students)
        failed_count = len(failed_students)
        
        # 更新年级排名
        if imported_count > 0:
            try:
                update_grade_rankings(selected_exam.pk)
            except Exception as e:
                # 排名更新失败不影响成绩导入的成功状态
                print(f"排名更新失败: {e}")
        
        # 返回简化的结果
        if imported_count > 0:
            message = f"上传成功！成功导入 {imported_count} 个学生"
            if failed_count > 0:
                message += f"，失败 {failed_count} 个学生"
            return JsonResponse({
                'success': True,
                'message': message,
                'imported_count': imported_count,
                'failed_count': failed_count,
                'error_details': error_details
            })
        else:
            return JsonResponse({
                'success': False,
                'message': f"上传失败！失败 {failed_count} 个学生",
                'imported_count': 0,
                'failed_count': failed_count,
                'error_details': error_details
            })
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f"文件处理失败：{str(e)}",
            'imported_count': 0,
            'failed_count': 0
        })


# 批量導入成績 (Excel) - 原版本保留用于获取表单
@require_http_methods(["GET", "POST"])
def score_batch_import(request):
    if request.method == 'POST':
        # 重定向到AJAX版本
        return score_batch_import_ajax(request)
            
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
        validation_errors = []  # 收集验证错误
        
        try:
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
                            # 手动调用clean方法进行验证
                            try:
                                score_obj.clean()
                            except ValidationError as e:
                                # 收集验证错误信息
                                error_msg = str(e.message) if hasattr(e, 'message') else str(e)
                                validation_errors.append(f"{subject_name}：{error_msg}")
                                continue
                            
                            if created:
                                created_count += 1
                            else:
                                updated_count += 1
                        except ValueError:
                            validation_errors.append(f'{subject_name} 的分数格式不正确')
                            continue
                    else:
                        # 如果分数为空，删除已存在的成绩记录
                        Score.objects.filter(
                            student=student,
                            exam=exam,
                            subject=subject_code
                        ).delete()
                
                # 如果有验证错误，抛出异常回滚事务
                if validation_errors:
                    raise ValidationError(validation_errors)
        
        except ValidationError:
            # 将验证错误信息合并为一个消息
            error_message = "\n".join(validation_errors)
            messages.error(request, error_message)
            return render(request, 'exams/score_batch_edit.html', {
                'student': student,
                'exam': exam,
                'existing_scores': get_existing_scores(student, exam),
                'subjects': SUBJECT_CHOICES,
                'subject_max_scores': get_subject_max_scores(exam)  # 添加满分信息
            })
        
        if created_count > 0 or updated_count > 0:
            messages.success(request, f'成功修改成绩！')
            # 更新年级排名
            try:
                update_grade_rankings(exam.pk, student.grade_level)
            except Exception as e:
                messages.warning(request, f'成绩保存成功，但排名更新失败: {e}')
        else:
            messages.info(request, '没有检测到任何更改')
        
        return redirect('score_list')
    
    # GET请求：显示编辑表单
    existing_scores = get_existing_scores(student, exam)
    
    context = {
        'student': student,
        'exam': exam,
        'existing_scores': existing_scores,
        'subjects': SUBJECT_CHOICES,
        'subject_max_scores': get_subject_max_scores(exam)  # 添加满分信息
    }
    return render(request, 'exams/score_batch_edit.html', context)

# 辅助函数：获取学生在某考试中的现有成绩
def get_existing_scores(student, exam):
    scores = Score.objects.filter(student=student, exam=exam)
    score_dict = {}
    for score in scores:
        score_dict[score.subject] = score.score_value
    return score_dict

# 新增辅助函数：获取考试中每个科目的满分
def get_subject_max_scores(exam):
    """
    获取指定考试中每个科目的满分配置
    返回格式：{'chinese': 150, 'math': 150, 'english': 120, ...}
    """
    exam_subjects = ExamSubject.objects.filter(exam=exam)
    max_scores = {}
    
    for exam_subject in exam_subjects:
        max_scores[exam_subject.subject_code] = exam_subject.max_score
    
    # 对于没有配置的科目，使用默认满分
    for subject_code, subject_name in SUBJECT_CHOICES:
        if subject_code not in max_scores:
            default_config = SUBJECT_DEFAULT_MAX_SCORES.get(exam.grade_level, {})
            max_scores[subject_code] = default_config.get(subject_code, 100)
    
    return max_scores

# 成绩查询主页面
def score_query(request):
    form = ScoreQueryForm()
    
    context = {
        'form': form,
        'page_title': '成绩查询',
    }
    
    return render(request, 'exams/score_query.html', context)

# 成绩查询结果页面
# 处理查询请求并显示结果，包含排名计算和科目排序
def score_query_results(request):
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
        subjects = form.cleaned_data.get('subject')  # 现在是列表
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
        
        # 科目筛选 - 支持多选
        subjects = form.cleaned_data.get('subject')  # 现在是列表
        if subjects:
            queryset = queryset.filter(subject__in=subjects)
        
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
# 计算成绩总分和年级排名，支持按科目、总分和排名排序
def calculate_scores_with_ranking(queryset, sort_by=None, subject_sort=None, sort_order='desc'):
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
    
    # 转换为列表并使用数据库中的排名
    results = []
    for data in student_exam_data.values():
        data['all_subjects'] = all_subjects
        
        # 从数据库中获取排名（取该学生该考试任意一条成绩记录的排名）
        sample_score = queryset.filter(
            student=data['student'],
            exam=data['exam']
        ).first()
        
        if sample_score and sample_score.total_score_rank_in_grade:
            data['grade_rank'] = sample_score.total_score_rank_in_grade
        else:
            data['grade_rank'] = None
            
        results.append(data)
    
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


# 成绩查询结果导出
def score_query_export(request):
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
        
    # 科目筛选 - 支持多选
    if subjects:  # subjects 现在是一个列表
        queryset = queryset.filter(subject__in=subjects)
    
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
            # 关键：传入 class_selection 以通过表单校验
            'class_selection': request.GET.get('class_selection', 'all'),
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
                    student__current_class__grade_level=grade_level
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
                try:
                    target_class = Class.objects.get(id=class_id)
                    
                    scores = Score.objects.filter(
                        exam=exam,
                        student__current_class=target_class
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
                    messages.error(request, f'班级 {class_id} 不存在')
                    
            else:
                # 场景2：多班级对比分析
                analysis_mode = 'class_comparison'
                selected_class_ids = [int(class_id) for class_id in url_selected_classes]
                selected_classes = Class.objects.filter(id__in=selected_class_ids)
                
                # 获取多班级对比分析数据
                analysis_result = _analyze_multiple_classes(selected_classes, exam)
                
                context = {
                    'form': form,
                    'available_classes': available_classes,
                    'page_title': '多班级成绩对比分析',
                    'analysis_type': 'class',
                    'from_analysis_page': from_analysis_page,
                    'show_class_selection': False,
                    'auto_analysis': True,
                    'analysis_mode': analysis_mode,
                    'selected_exam': exam,
                    'selected_grade': grade_level,
                    'selected_classes': selected_classes,
                    **analysis_result
                }
                return render(request, 'exams/score_analysis_class_multi.html', context)
    
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
                'student__current_class__grade_level': grade_level,
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
        elif analysis_mode == 'class_comparison':
            # 多班级对比分析的数据处理
            analysis_data = _analyze_multiple_classes(selected_classes, exam)
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
    
    # 根据分析模式选择不同的模板
    if context.get('analysis_mode') == 'class_comparison':
        return render(request, 'exams/score_analysis_class_multi.html', context)
    else:
        return render(request, 'exams/score_analysis_class.html', context)

# AJAX接口：根据年级获取班级列表
def get_classes_by_grade(request):
    """根据年级获取班级列表的AJAX接口"""
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
            
            # 获取该科目的满分
            subject_max_score = 100  # 默认满分
            try:
                exam_subject = exam.exam_subjects.filter(subject=subject_code).first()
                if exam_subject:
                    subject_max_score = exam_subject.max_score
                else:
                    # 如果ExamSubject不存在，从SUBJECT_DEFAULT_MAX_SCORES中获取默认满分
                    grade_config = SUBJECT_DEFAULT_MAX_SCORES.get(exam.grade_level, {})
                    subject_max_score = grade_config.get(subject_code, 100)
            except:
                # 异常情况下，尝试从默认配置获取
                grade_config = SUBJECT_DEFAULT_MAX_SCORES.get(exam.grade_level, {})
                subject_max_score = grade_config.get(subject_code, 100)
            
            # 成绩分布统计（按等级百分比）
            grade_ranges = {
                '特优(95%+)': subject_scores.filter(score_value__gte=subject_max_score * 0.95).count(),
                '优秀(85%-95%)': subject_scores.filter(score_value__gte=subject_max_score * 0.85, score_value__lt=subject_max_score * 0.95).count(),
                '良好(70%-85%)': subject_scores.filter(score_value__gte=subject_max_score * 0.70, score_value__lt=subject_max_score * 0.85).count(),
                '及格(60%-70%)': subject_scores.filter(score_value__gte=subject_max_score * 0.60, score_value__lt=subject_max_score * 0.70).count(),
                '不及格(<60%)': subject_scores.filter(score_value__lt=subject_max_score * 0.60).count(),
            }
            score_distribution[subject_code] = grade_ranges
    
    # 学生总分排名 - 使用Django ORM聚合查询避免重复
    student_total_scores = []
    
    # 使用values和annotate来按学生分组并计算总分
    student_scores = scores.values('student__id', 'student__name').annotate(
        total_score=Sum('score_value'),
        subject_count=Count('subject')
    ).order_by('-total_score')
    
    # 转换为列表格式并添加排名和年级排名
    for i, student_data in enumerate(student_scores):
        student_id = student_data['student__id']
        
        # 获取该学生的年级排名（从数据库中的total_score_rank_in_grade字段获取）
        grade_rank = None
        sample_score = scores.filter(student_id=student_id).first()
        if sample_score:
            grade_rank = sample_score.total_score_rank_in_grade
        
        
        student_total_scores.append({
            'student_id': student_id,
            'student_name': student_data['student__name'],
            'total_score': float(student_data['total_score']),
            'subject_count': student_data['subject_count'],
            'rank': i + 1,
            'grade_rank': grade_rank
        })
    
    # 班级总体统计
    if student_total_scores:
        class_avg_total = sum([s['total_score'] for s in student_total_scores]) / len(student_total_scores)
        class_max_total = max([s['total_score'] for s in student_total_scores])
        class_min_total = min([s['total_score'] for s in student_total_scores])
    else:
        class_avg_total = class_max_total = class_min_total = 0
    
    # 计算总分满分
    total_max_score = 0
    exam_subjects = exam.exam_subjects.all()
    for exam_subject in exam_subjects:
        total_max_score += exam_subject.max_score
    
    # 计算等级分布（基于总分百分比）
    grade_distribution = {
        '特优(95%+)': 0,
        '优秀(85%-95%)': 0,
        '良好(70%-85%)': 0,
        '及格(60%-70%)': 0,
        '不及格(<60%)': 0
    }
    
    # 统计各等级人数
    for student_data in student_total_scores:
        if total_max_score > 0:
            percentage = student_data['total_score'] / total_max_score
            if percentage >= 0.95:
                grade_distribution['特优(95%+)'] += 1
            elif percentage >= 0.85:
                grade_distribution['优秀(85%-95%)'] += 1
            elif percentage >= 0.70:
                grade_distribution['良好(70%-85%)'] += 1
            elif percentage >= 0.60:
                grade_distribution['及格(60%-70%)'] += 1
            else:
                grade_distribution['不及格(<60%)'] += 1
    
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
            'rank': s['rank'],
            'grade_rank': s['grade_rank']
        } for s in student_total_scores[:10]],  # 只显示前10名
        'total_max_score': total_max_score,
        'grade_distribution': grade_distribution
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

# 多班级对比分析
def _analyze_multiple_classes(selected_classes, exam):
    # 获取所有选中班级的成绩数据
    all_scores = Score.objects.filter(
        exam=exam,
        student__current_class__in=selected_classes
    ).select_related('student', 'student__current_class')
    
    # 获取考试科目
    exam_subjects = ExamSubject.objects.filter(exam=exam)
    subjects = [es.subject_code for es in exam_subjects]
    
    # 辅助函数：将Decimal转换为float
    def decimal_to_float(value):
        if isinstance(value, Decimal):
            return float(value)
        return value
    
    # 按班级分组统计数据
    class_statistics = []
    class_subject_averages = {}
    score_distributions = {}
    total_students = 0
    highest_avg = 0
    
    for class_obj in selected_classes:
        class_scores = all_scores.filter(student__current_class=class_obj)
        
        # 基本统计信息
        student_count = class_scores.values('student').distinct().count()
        total_students += student_count
        
        # 计算各科目平均分
        subject_averages = []
        class_name = f"{class_obj.grade_level}{class_obj.class_name}"
        class_subject_averages[class_name] = []
        
        for subject in subjects:
            subject_scores = class_scores.filter(subject=subject)
            scores_list = [decimal_to_float(score.score_value) for score in subject_scores if score.score_value is not None]
            
            if scores_list:
                avg_score = statistics.mean(scores_list)
                subject_averages.append(round(avg_score, 2))
                class_subject_averages[class_name].append(round(avg_score, 2))
            else:
                subject_averages.append(0)
                class_subject_averages[class_name].append(0)
        
        # 计算总分统计
        student_totals = {}
        for score in class_scores:
            if score.student.id not in student_totals:
                student_totals[score.student.id] = 0
            if score.score_value is not None:
                student_totals[score.student.id] += decimal_to_float(score.score_value)
        
        total_scores_list = list(student_totals.values()) if student_totals else [0]
        avg_total = statistics.mean(total_scores_list) if total_scores_list else 0
        max_total = max(total_scores_list) if total_scores_list else 0
        min_total = min(total_scores_list) if total_scores_list else 0
        
        # 确保所有数值都是float类型
        avg_total = round(float(avg_total), 2)
        max_total = float(max_total)
        min_total = float(min_total)
        
        if avg_total > highest_avg:
            highest_avg = avg_total
        
        # 等级分布统计（基于百分比）
        score_dist = [0, 0, 0, 0, 0]  # 特优(95%+), 优秀(85%-95%), 良好(70%-85%), 及格(60%-70%), 不及格(<60%)
        
        # 计算满分
        exam_subjects = exam.exam_subjects.all()
        total_max_score = sum(es.max_score for es in exam_subjects)
        
        for total in total_scores_list:
            if total_max_score > 0:
                percentage = (total / total_max_score) * 100
                if percentage >= 95:
                    score_dist[0] += 1  # 特优(95%+)
                elif percentage >= 85:
                    score_dist[1] += 1  # 优秀(85%-95%)
                elif percentage >= 70:
                    score_dist[2] += 1  # 良好(70%-85%)
                elif percentage >= 60:
                    score_dist[3] += 1  # 及格(60%-70%)
                else:
                    score_dist[4] += 1  # 不及格(<60%)
        
        score_distributions[class_name] = score_dist
        
        class_statistics.append({
            'class_name': class_name,
            'student_count': student_count,
            'avg_total': decimal_to_float(avg_total),
            'max_total': decimal_to_float(max_total),
            'min_total': decimal_to_float(min_total),
            'subject_averages': subject_averages
        })
    
    # 准备图表数据
    chart_data = {
        'subjects': subjects,
        'classes': list(class_subject_averages.keys()),
        'class_subject_averages': class_subject_averages,
        'score_distributions': score_distributions
    }
    
    # 获取科目名称映射
    subject_names = []
    for subject_code in subjects:
        exam_subject = exam_subjects.filter(subject_code=subject_code).first()
        if exam_subject:
            subject_names.append(exam_subject.subject_name)
        else:
            # 从SUBJECT_CHOICES中获取名称
            for code, name in SUBJECT_CHOICES:
                if code == subject_code:
                    subject_names.append(name)
                    break
            else:
                subject_names.append(subject_code)
    
    return {
        'class_statistics': class_statistics,
        'subjects': [{'code': code, 'name': name} for code, name in zip(subjects, subject_names)],
        'total_students': total_students,
        'subject_count': len(subjects),
        'highest_avg': float(highest_avg),
        'chart_data_json': json.dumps(chart_data),
        'academic_year': exam.academic_year
    }

# 年级成绩分析
def score_analysis_grade(request):
    form = ScoreAnalysisForm(request.GET or None)
    
    # 检查是否从score_analysis页面传递了参数
    from_analysis_page = bool(request.GET.get('academic_year') and 
                             request.GET.get('exam') and 
                             request.GET.get('grade_level'))
    
    context = {
        'form': form,
        'page_title': '年级成绩分析',
        'analysis_type': 'grade',
        'from_analysis_page': from_analysis_page,
    }
    
    if from_analysis_page:
        # 构造一个临时的form数据用于分析
        temp_form_data = {
            'academic_year': request.GET.get('academic_year'),
            'exam': request.GET.get('exam'),
            'grade_level': request.GET.get('grade_level'),
            # 关键：传入 class_selection 以通过表单校验
            'class_selection': request.GET.get('class_selection', 'all'),
        }
        temp_form = ScoreAnalysisForm(temp_form_data)
        
        if temp_form.is_valid():
            academic_year = temp_form.cleaned_data['academic_year']
            exam = temp_form.cleaned_data['exam']
            grade_level = temp_form.cleaned_data['grade_level']
            
            # 获取年级整体分析数据
            analysis_result = _analyze_grade(exam, grade_level)
            
            context.update({
                'selected_exam': exam,
                'selected_grade': grade_level,
                'academic_year': academic_year,
                **analysis_result
            })
    
    return render(request, 'exams/score_analysis_grade.html', context)

# 年级成绩分析辅助函数
def _analyze_grade(exam, grade_level):
    # 辅助函数：将Decimal转换为float
    def decimal_to_float(value):
        if value is None:
            return 0.0
        if isinstance(value, Decimal):
            return float(value)
        return value
    
    # 获取该年级的所有班级
    classes = Class.objects.filter(grade_level=grade_level).order_by('class_name')
    
    # 获取该年级该考试的所有成绩
    all_scores = Score.objects.filter(
        exam=exam,
        student__current_class__grade_level=grade_level
    ).select_related('student', 'student__current_class')
    
    # 获取考试科目
    exam_subjects = ExamSubject.objects.filter(exam=exam)
    subjects = [{'code': es.subject_code, 'name': dict(SUBJECT_CHOICES).get(es.subject_code, es.subject_code), 'max_score': es.max_score} for es in exam_subjects]
    
    # 基本统计
    total_students = all_scores.values('student').distinct().count()
    total_classes = classes.count()
    
    # 按班级分组统计
    class_statistics = []
    class_names = []
    class_averages = []
    class_grade_distribution = {}
    
    # 科目统计
    subject_stats = {}
    for subject in subjects:
        subject_code = subject['code']
        subject_scores = all_scores.filter(subject=subject_code)
        if subject_scores.exists():
            avg_score = subject_scores.aggregate(avg=Avg('score_value'))['avg']
            subject_stats[subject_code] = {
                'name': subject['name'],
                'avg_score': decimal_to_float(avg_score),
                'max_score': subject['max_score']
            }
    
    # 计算总分和年级平均分
    student_totals = {}
    for score in all_scores:
        if score.student.id not in student_totals:
            student_totals[score.student.id] = 0
        if score.score_value is not None:
            student_totals[score.student.id] += decimal_to_float(score.score_value)
    
    total_scores_list = list(student_totals.values()) if student_totals else [0]
    grade_avg_score = statistics.mean(total_scores_list) if total_scores_list else 0
    
    # 计算总分满分
    total_max_score = sum([subject['max_score'] for subject in subjects])
    
    # 计算年级优秀率（95%以上）
    excellent_count = sum(1 for score in total_scores_list if score >= total_max_score * 0.95)
    excellent_rate = (excellent_count / len(total_scores_list) * 100) if total_scores_list else 0
    
    # 各班级详细统计
    for class_obj in classes:
        class_scores = all_scores.filter(student__current_class=class_obj)
        
        if not class_scores.exists():
            continue
            
        class_name = f"{class_obj.grade_level}{class_obj.class_name}"
        class_names.append(class_name)
        
        # 班级学生总分统计
        class_student_totals = {}
        for score in class_scores:
            if score.student.id not in class_student_totals:
                class_student_totals[score.student.id] = 0
            if score.score_value is not None:
                class_student_totals[score.student.id] += decimal_to_float(score.score_value)
        
        class_total_scores = list(class_student_totals.values()) if class_student_totals else [0]
        avg_total = statistics.mean(class_total_scores) if class_total_scores else 0
        max_total = max(class_total_scores) if class_total_scores else 0
        min_total = min(class_total_scores) if class_total_scores else 0
        
        class_averages.append(decimal_to_float(avg_total))
        
        # 计算各等级人数和比例
        student_count = len(class_total_scores)
        excellent_count = sum(1 for score in class_total_scores if score >= total_max_score * 0.95)
        good_count = sum(1 for score in class_total_scores if total_max_score * 0.85 <= score < total_max_score * 0.95)
        pass_count = sum(1 for score in class_total_scores if total_max_score * 0.6 <= score < total_max_score * 0.85)
        fail_count = sum(1 for score in class_total_scores if score < total_max_score * 0.6)
        
        excellent_rate = (excellent_count / student_count * 100) if student_count > 0 else 0
        good_rate = (good_count / student_count * 100) if student_count > 0 else 0
        pass_rate = ((excellent_count + good_count + pass_count) / student_count * 100) if student_count > 0 else 0
        
        # 各科目平均分
        subject_averages = []
        for subject in subjects:
            subject_code = subject['code']
            class_subject_scores = class_scores.filter(subject=subject_code)
            if class_subject_scores.exists():
                avg = class_subject_scores.aggregate(avg=Avg('score_value'))['avg']
                subject_averages.append(decimal_to_float(avg))
            else:
                subject_averages.append(0)
        
        class_statistics.append({
            'class_name': class_name,
            'student_count': student_count,
            'avg_total': decimal_to_float(avg_total),
            'max_total': decimal_to_float(max_total),
            'min_total': decimal_to_float(min_total),
            'excellent_rate': excellent_rate,
            'good_rate': good_rate,
            'pass_rate': pass_rate,
            'subject_averages': subject_averages
        })
        
        # 班级等级分布（用于堆叠柱状图）
        class_grade_distribution[class_name] = [excellent_count, good_count, pass_count, fail_count]
    
    # 年级成绩分布（总分分段统计）
    score_ranges = ['优秀(95%+)', '良好(85%-95%)', '及格(60%-85%)', '不及格(<60%)']
    score_distribution = [0, 0, 0, 0]
    
    for total_score in total_scores_list:
        if total_score >= total_max_score * 0.95:
            score_distribution[0] += 1
        elif total_score >= total_max_score * 0.85:
            score_distribution[1] += 1
        elif total_score >= total_max_score * 0.6:
            score_distribution[2] += 1
        else:
            score_distribution[3] += 1
    
    # 科目难度系数计算（平均分/满分）
    difficulty_coefficients = []
    subject_names = []
    subject_averages = []
    subject_max_scores = []
    
    for subject in subjects:
        subject_code = subject['code']
        if subject_code in subject_stats:
            subject_names.append(subject_stats[subject_code]['name'])
            subject_averages.append(subject_stats[subject_code]['avg_score'])
            subject_max_scores.append(subject['max_score'])
            difficulty_coefficient = subject_stats[subject_code]['avg_score'] / subject['max_score']
            difficulty_coefficients.append(difficulty_coefficient)
    
    # 准备图表数据
    chart_data = {
        'class_names': class_names,
        'class_averages': class_averages,
        'subject_names': subject_names,
        'subject_averages': subject_averages,
        'subject_max_scores': subject_max_scores,
        'score_ranges': score_ranges,
        'score_distribution': score_distribution,
        'class_grade_distribution': class_grade_distribution,
        'difficulty_coefficients': difficulty_coefficients
    }
    
    return {
        'total_students': total_students,
        'total_classes': total_classes,
        'grade_avg_score': decimal_to_float(grade_avg_score),
        'excellent_rate': excellent_rate,
        'class_statistics': class_statistics,
        'subjects': subjects,
        'chart_data_json': json.dumps(chart_data, ensure_ascii=False)
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

# AJAX端点：根据输入的关键字搜索学生
# 支持按姓名、学号、年级班级进行模糊搜索
@require_http_methods(["GET"])
def search_students_ajax(request):
    query = request.GET.get('q', '').strip()
    
    if not query:
        return JsonResponse({'students': []})
    
    # 构建搜索条件
    search_conditions = Q()
    
    # 按姓名搜索
    search_conditions |= Q(name__icontains=query)
    
    # 按学号搜索
    search_conditions |= Q(student_id__icontains=query)
    
    # 按年级班级搜索（通过关联的Class模型）
    search_conditions |= Q(current_class__grade_level__icontains=query)
    search_conditions |= Q(current_class__class_name__icontains=query)
    
    # 执行搜索，限制结果数量避免性能问题
    students = Student.objects.filter(search_conditions).select_related('current_class').order_by('name', 'student_id')[:20]
    
    # 构建返回数据
    student_list = []
    for student in students:
        class_info = ''
        if student.current_class:
            class_info = f"{student.current_class.grade_level}{student.current_class.class_name}"
        
        student_list.append({
            'id': student.id,
            'text': f"{student.name}-{student.student_id}-{class_info}",
            'name': student.name,
            'student_id': student.student_id,
            'class_info': class_info
        })
    
    return JsonResponse({'students': student_list})



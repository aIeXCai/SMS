from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods, require_POST
from django.db import transaction
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from datetime import datetime
import json


from ..models import Exam, ExamSubject, GRADE_LEVEL_CHOICES, SUBJECT_CHOICES, SUBJECT_DEFAULT_MAX_SCORES, ACADEMIC_YEAR_CHOICES
from ..forms import ExamCreateForm, ExamSubjectFormSet

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
            return redirect('students_grades:exam_create_step2')
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
        return redirect('students_grades:exam_create_step1')
    
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
                    return redirect('students_grades:exam_list')
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
        # 构造 initial 数据，后端初始化默认科目和分数
        initial_data = []
        for subject_code, max_score in default_subjects.items():
            initial_data.append({
                'subject_code': subject_code,
                'max_score': max_score
            })
        formset = ExamSubjectFormSet(initial=initial_data, grade_level=grade_level)
    
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
            return redirect('students_grades:exam_edit_step2', pk=pk)
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
        return redirect('students_grades:exam_edit_step1', pk=pk)
    
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
                    return redirect('students_grades:exam_list')
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
    return redirect('students_grades:exam_list')
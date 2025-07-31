from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods, require_POST

from .models import Exam # 導入 Exam 模型
from .forms import ExamForm # 導入 ExamForm 表單

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
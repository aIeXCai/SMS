from django.shortcuts import render, redirect, get_object_or_404
from .models import Student, Class # 導入你定義的模型
from .forms import StudentForm     # 稍後我們會創建這個表單

# 學生列表頁面 (PRD 3.1.1)
def student_list(request):
    students = Student.objects.all() # 從資料庫獲取所有學生資料
    return render(request, 'students/student_list.html', {'students': students})

# 新增學生功能 (PRD 3.1.2)
def student_add(request):
    if request.method == 'POST':
        form = StudentForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('student_list') # 新增成功後跳轉回列表頁
    else:
        form = StudentForm()
    return render(request, 'students/student_form.html', {'form': form, 'form_title': '新增学生'})

# 修改學生功能 (PRD 3.1.3)
def student_edit(request, pk):
    student = get_object_or_404(Student, pk=pk) # 根據 ID 獲取學生，如果找不到則返回 404
    if request.method == 'POST':
        form = StudentForm(request.POST, instance=student) # instance=student 表示修改現有對象
        if form.is_valid():
            form.save()
            return redirect('student_list') # 修改成功後跳轉回列表頁
    else:
        form = StudentForm(instance=student) # 初始化表單時預填現有資料
    return render(request, 'students/student_form.html', {'form': form, 'form_title': '编辑学生'})

# 刪除學生功能 (PRD 3.1.4)
def student_delete(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        student.delete()
        return redirect('student_list') # 刪除成功後跳轉回列表頁
    return render(request, 'students/student_confirm_delete.html', {'student': student})
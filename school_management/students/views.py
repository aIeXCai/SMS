from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_POST, require_http_methods
from django.contrib import messages # 用於顯示操作成功或失敗訊息
from django.db import transaction # 用於確保批量操作的原子性
from django.utils import timezone
import openpyxl # 導入 openpyxl 庫
from datetime import datetime
from django.db.models import Q

from .models import Student, Class, GRADE_LEVEL_CHOICES, CLASS_NAME_CHOICES, STATUS_CHOICES
from .forms import StudentForm, ExcelUploadForm, BatchUpdateStatusForm, BatchPromoteGradeForm

# 學生列表頁面 (PRD 3.1.1)
def student_list(request):
    students = Student.objects.all()

    # --- 篩選邏輯開始 ---
    # 1. 全局搜索 (學號和姓名)
    search_query = request.GET.get('q') # 從 URL 參數獲取搜索關鍵字，例如: /students/?q=张三
    if search_query:
        students = students.filter(
            Q(student_id__icontains=search_query) | # 學號包含關鍵字 (不區分大小寫)
            Q(name__icontains=search_query)        # 姓名包含關鍵字 (不區分大小寫)
        )

    # 2. 班級名稱篩選
    # class_name 變數會接收 '1班', '2班' 等值
    class_name_filter = request.GET.get('class_name_filter') # 注意這裡的參數名，與前端對應
    if class_name_filter:
        # 篩選出所有符合該班級名稱的 Class 對象 (例如所有年級的 '1班')
        matching_classes = Class.objects.filter(class_name=class_name_filter)
        # 然後用這些班級來篩選學生
        students = students.filter(current_class__in=matching_classes)
            
    # 3. 年級篩選
    grade_level = request.GET.get('grade') # 從 URL 參數獲取年級
    if grade_level:
        students = students.filter(current_class__grade_level=grade_level)

    # 4. 狀態篩選
    status = request.GET.get('status') # 從 URL 參數獲取狀態
    if status:
        students = students.filter(status=status)
    # --- 篩選邏輯結束 ---

    # 獲取所有班級，用於班級篩選下拉選單
    classes = Class.objects.all().order_by('grade_level', 'class_name')

    return render(request, 'students/student_list.html', {
        'students': students,
        'status_choices': STATUS_CHOICES,        
        'grade_level_choices': GRADE_LEVEL_CHOICES, 
        'class_name_choices': CLASS_NAME_CHOICES,   # 傳遞全局班級名稱選項
        'search_query': search_query if search_query else '', 
        'selected_class_name_filter': class_name_filter if class_name_filter else '', # 將選中的班級名稱傳回模板
        'selected_grade': grade_level if grade_level else '', 
        'selected_status': status if status else '',  
    })


    student = get_object_or_404(Student, pk=pk) # 根據 ID 獲取學生，如果找不到則返回 404
    if request.method == 'POST':
        form = StudentForm(request.POST, instance=student) # instance=student 表示修改現有對象
        if form.is_valid():
            form.save()
            return redirect('student_list') # 修改成功後跳轉回列表頁
    else:
        form = StudentForm(instance=student) # 初始化表單時預填現有資料
    return render(request, 'students/student_form.html', {'form': form, 'form_title': '编辑学生'})

# 新增學生頁面 (PRD 3.1.3)
@require_http_methods(["GET", "POST"])
def student_add(request):
    if request.method == 'POST':
        form = StudentForm(request.POST)
        if form.is_valid():
            form.save() # StudentForm 的 save 方法會處理 Class 的查找或創建
            messages.success(request, "学生新增成功！")
            return redirect('student_list')
        else:
            messages.error(request, "新增学生失败，请检查表单数据。")
    else:
        form = StudentForm()
    
    # 傳遞年級和班級選項給模板，以便前端可以動態加載（如果未來實現聯動）
    return render(request, 'students/student_form.html', {
        'form': form,
        'title': '新增学生',
        'grade_level_choices': GRADE_LEVEL_CHOICES, # 傳遞給模板
        'class_name_choices': CLASS_NAME_CHOICES,   # 傳遞給模板
    })

# 修改學生頁面 (PRD 3.1.4)
@require_http_methods(["GET", "POST"])
def student_edit(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        form = StudentForm(request.POST, instance=student)
        if form.is_valid():
            form.save() # StudentForm 的 save 方法會處理 Class 的查找或創建
            messages.success(request, "学生信息更新成功！")
            return redirect('student_list')
        else:
            messages.error(request, "更新学生信息失败，请检查表单数据。")
    else:
        form = StudentForm(instance=student)
    
    return render(request, 'students/student_form.html', {
        'form': form,
        'title': '编辑学生',
        'grade_level_choices': GRADE_LEVEL_CHOICES, # 傳遞給模板
        'class_name_choices': CLASS_NAME_CHOICES,   # 傳遞給模板
    })

# 刪除學生功能 (PRD 3.1.4)
def student_delete(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        student.delete()
        return redirect('student_list') # 刪除成功後跳轉回列表頁
    return render(request, 'students/student_confirm_delete.html', {'student': student})

# 學生狀態一鍵切換功能 (PRD 3.1.5)
@require_POST # 确保这个视图只接受 POST 请求，增强安全性
def student_update_status(request, pk):
    student = get_object_or_404(Student, pk=pk)
    
    # 從 POST 數據中獲取新的狀態
    new_status = request.POST.get('status') 
    
    # 檢查新狀態是否在 Student 模型定義的有效選項中
    valid_statuses = [choice[0] for choice in STATUS_CHOICES]
    if new_status and new_status in valid_statuses:
        student.status = new_status
        # 如果狀態是「畢業」，自動設定畢業日期 (根據 PRD 3.1.7 預留的邏輯，這裡可以做簡易處理)
        if new_status == '畢業' and not student.graduation_date:
            from django.utils import timezone
            student.graduation_date = timezone.now().date() # 設置為當前日期
        
        student.save()
        # 可以添加 Django messages 提示操作成功，這裡暫不展開
        # from django.contrib import messages
        # messages.success(request, f"{student.name} 的狀態已更新為 {new_status}。")
    
    return redirect('student_list') # 更新後導回學生列表頁面

# 批量導入學生 (從 Excel) - PRD 3.1.2 擴展
@require_http_methods(["GET", "POST"])
def student_batch_import(request):
    if request.method == 'POST':
        form = ExcelUploadForm(request.POST, request.FILES)
        if form.is_valid():
            excel_file = request.FILES['excel_file']
            
            # 檢查文件類型，確保是 Excel 文件
            if not excel_file.name.endswith(('.xlsx', '.xls')):
                messages.error(request, "文件格式不正确，请上传 .xlsx 或 .xls 文件。")
                return render(request, 'students/batch_operation_form.html', {'form': form, 'title': '批量导入学生'})

            try:
                workbook = openpyxl.load_workbook(excel_file)
                sheet = workbook.active
                
                header = [cell.value for cell in sheet[1]] # 獲取第一行的標題
                
                # 預期 Excel 欄位名稱 (與 Model 字段名對應)
                # 注意：这里需要与你的 Excel 模板的列名精确对应
                # 例如：学号, 姓名, 性别, 出生日期, 班级名称, 年级, 在校状态, 身份证号码, 学籍号, 家庭地址, 监护人姓名, 监护人联系电话, 入学日期, 毕业日期
                
                # 简化处理，假设 Excel 列顺序固定且名称一致
                # 你需要根據實際 Excel 模板的列順序和名稱來調整這裡的索引或映射
                # 這裡僅為範例，實際開發需要更健壯的錯誤處理和列名映射
                
                # 定义 Excel 列名到模型字段名的映射
                column_mapping = {
                    '学号': 'student_id',
                    '姓名': 'name',
                    '性别': 'gender',
                    '出生日期': 'date_of_birth',
                    '班级名称': 'class_name', # 這是班級名稱，需要找到對應的 Class 對象
                    '年级': 'grade_level', # 這是年級，需要和班級名稱一起找到 Class 對象
                    '在校状态': 'status',
                    '身份证号码': 'id_card_number',
                    '学籍号': 'student_enrollment_number',
                    '家庭地址': 'home_address',
                    '监护人姓名': 'guardian_name',
                    '监护人联系电话': 'guardian_contact_phone',
                    '入学日期': 'entry_date',
                    '毕业日期': 'graduation_date',
                }
                
                # 驗證 Excel 標頭是否包含所有必要字段
                missing_columns = [col for col_label, col in column_mapping.items() if col_label not in header and col_label not in ['班级名称', '年级']] # 班级年级是组合查找
                if missing_columns:
                    messages.error(request, f"Excel 文件缺少以下必需的列：{', '.join(missing_columns)}")
                    return render(request, 'students/batch_operation_form.html', {'form': form, 'title': '批量导入学生'})


                students_to_create = []
                students_to_update = []
                errors = []
                
                with transaction.atomic(): # 使用事務，確保導入過程的原子性
                    for row_idx, row_cells in enumerate(sheet.iter_rows(min_row=2, values_only=True)): # 從第二行開始讀取數據
                        row_data = dict(zip(header, row_cells)) # 將行數據映射到標題
                        
                        student_id = row_data.get('学号')
                        if not student_id:
                            errors.append(f"第 {row_idx + 2} 行：学号为空，跳过此行。")
                            continue

                        try:
                            # 處理班級和年級
                            class_name_val = row_data.get('班级名称')
                            grade_level_val = row_data.get('年级')
                            current_class_obj = None
                            if class_name_val and grade_level_val:
                                # 嘗試獲取或創建班級
                                current_class_obj, created = Class.objects.get_or_create(
                                    class_name=class_name_val,
                                    grade_level=grade_level_val
                                )
                                if created:
                                    messages.info(request, f"班级 {grade_level_val}{class_name_val} 不存在，已自动创建。")
                            
                            # 格式化日期字段
                            date_of_birth_val = row_data.get('出生日期')
                            if isinstance(date_of_birth_val, datetime):
                                date_of_birth_val = date_of_birth_val.date()
                            elif date_of_birth_val:
                                date_of_birth_val = datetime.strptime(str(date_of_birth_val).split(' ')[0], '%Y-%m-%d').date() # 處理可能的日期時間格式

                            entry_date_val = row_data.get('入学日期')
                            if isinstance(entry_date_val, datetime):
                                entry_date_val = entry_date_val.date()
                            elif entry_date_val:
                                entry_date_val = datetime.strptime(str(entry_date_val).split(' ')[0], '%Y-%m-%d').date()

                            graduation_date_val = row_data.get('毕业日期')
                            if isinstance(graduation_date_val, datetime):
                                graduation_date_val = graduation_date_val.date()
                            elif graduation_date_val:
                                graduation_date_val = datetime.strptime(str(graduation_date_val).split(' ')[0], '%Y-%m-%d').date()
                            
                            student_data = {
                                'student_id': student_id,
                                'name': row_data.get('姓名'),
                                'gender': row_data.get('性别'),
                                'date_of_birth': date_of_birth_val,
                                'current_class': current_class_obj,
                                'status': row_data.get('在校状态', '在讀'), # 默認在讀
                                'id_card_number': row_data.get('身份证号码'),
                                'student_enrollment_number': row_data.get('学籍号'),
                                'home_address': row_data.get('家庭地址'),
                                'guardian_name': row_data.get('监护人姓名'),
                                'guardian_contact_phone': row_data.get('监护人联系电话'),
                                'entry_date': entry_date_val,
                                'graduation_date': graduation_date_val,
                            }
                            
                            # 根據學號判斷是新增還是更新
                            existing_student = Student.objects.filter(student_id=student_id).first()
                            if existing_student:
                                # 更新现有学生信息 (如果需要)
                                for key, value in student_data.items():
                                    if key != 'student_id' and value is not None: # 不更新学号，None值不覆盖
                                        setattr(existing_student, key, value)
                                students_to_update.append(existing_student)
                            else:
                                students_to_create.append(Student(**student_data))

                        except Exception as e:
                            errors.append(f"第 {row_idx + 2} 行数据处理失败：{e}")
                            continue
                
                if students_to_create:
                    Student.objects.bulk_create(students_to_create)
                    messages.success(request, f"成功新增 {len(students_to_create)} 名学生。")
                
                if students_to_update:
                    # 使用 bulk_update 可以批量更新字段，但需要指定更新的字段
                    # 或者循环保存 (如果字段较多或逻辑复杂)
                    for student in students_to_update:
                        student.save() # 这里会触发每个对象的 save 方法
                    messages.success(request, f"成功更新 {len(students_to_update)} 名学生信息。")

                if errors:
                    for err in errors:
                        messages.warning(request, err)
                    messages.error(request, "部分学生数据导入失败，请检查警告信息。")
                
                return redirect('student_list')

            except Exception as e:
                messages.error(request, f"文件读取或处理过程中发生错误：{e}")
                return render(request, 'students/batch_operation_form.html', {'form': form, 'title': '批量导入学生'})
    else:
        form = ExcelUploadForm()
    return render(request, 'students/batch_operation_form.html', {'form': form, 'title': '批量导入学生'})

# 批量刪除學生
@require_POST
def student_batch_delete(request):
    # 從 POST 請求中獲取選中學生的 ID 列表
    selected_student_ids = request.POST.getlist('selected_students')
    
    if not selected_student_ids:
        messages.warning(request, "没有选择任何学生进行删除。")
        return redirect('student_list')
    
    try:
        with transaction.atomic(): # 確保刪除操作的原子性
            # 獲取所有選中的學生對象
            students_to_delete = Student.objects.filter(pk__in=selected_student_ids)
            deleted_count, _ = students_to_delete.delete() # 执行删除
            messages.success(request, f"成功删除 {deleted_count} 名学生。")
    except Exception as e:
        messages.error(request, f"批量删除学生失败：{e}")
    
    return redirect('student_list')

# 批量修改學生狀態
@require_POST
def student_batch_update_status(request):
    selected_student_ids = request.POST.getlist('selected_students')
    form = BatchUpdateStatusForm(request.POST)

    if not selected_student_ids:
        messages.warning(request, "没有选择任何学生进行状态修改。")
        return redirect('student_list')
        
    if form.is_valid():
        new_status = form.cleaned_data['status']
        try:
            with transaction.atomic(): # 確保更新操作的原子性
                # 篩選出需要更新的學生
                students_to_update = Student.objects.filter(pk__in=selected_student_ids)
                
                # 如果新狀態是「畢業」，自動設定畢業日期
                if new_status == '畢業':
                    # 只更新狀態不是「畢業」的學生，並設定畢業日期
                    updated_count = students_to_update.exclude(status='畢業').update(status=new_status, graduation_date=timezone.now().date())
                    # 對於已經是畢業狀態的，只更新狀態（雖然這裡實際不會再更新）
                    students_to_update.filter(status='畢業').update(status=new_status)
                else:
                    updated_count = students_to_update.update(status=new_status)

                messages.success(request, f"成功更新 {updated_count} 名学生的狀態为 '{new_status}'。")
        except Exception as e:
            messages.error(request, f"批量更新學生狀態失敗：{e}")
    else:
        # 如果表單無效，通常是前端驗證被繞過，或有其他問題
        messages.error(request, "提交的狀態無效，請重試。")
    
    return redirect('student_list')

# 批量升年級 PRD 3.1.6
@require_http_methods(["GET", "POST"])
def student_batch_promote_grade(request):
    if request.method == 'POST':
        form = BatchPromoteGradeForm(request.POST)
        if form.is_valid():
            current_grade_level = form.cleaned_data['current_grade_level']
            target_grade_level = form.cleaned_data['target_grade_level']
            auto_create_classes = form.cleaned_data['auto_create_classes']
            
            # 獲取所有選中的學生 ID
            selected_student_ids = request.POST.getlist('selected_students')
            
            if not selected_student_ids:
                messages.warning(request, "没有选择任何学生进行升年级操作。")
                return redirect('student_list')
            
            # 邏輯檢查：目標年級不能是空，也不能與當前年級相同（如果當前年級被選中）
            if not target_grade_level:
                messages.error(request, "请选择目标年级。")
                return render(request, 'students/batch_promote_grade_form.html', {'form': form, 'title': '批量升年级'})

            if current_grade_level and current_grade_level == target_grade_level:
                messages.warning(request, "目标年级不能与当前年级相同。")
                return render(request, 'students/batch_promote_grade_form.html', {'form': form, 'title': '批量升年级'})
            
            updated_count = 0
            errors = []
            
            with transaction.atomic():
                students_to_promote = Student.objects.filter(pk__in=selected_student_ids)

                # 如果設定了篩選的「當前年級」，則只處理符合該年級的學生
                if current_grade_level:
                    students_to_promote = students_to_promote.filter(current_class__grade_level=current_grade_level)

                for student in students_to_promote:
                    try:
                        current_class = student.current_class
                        if current_class:
                            # 找出目標年級中，與當前班級名稱相同的班級
                            target_class_obj = Class.objects.filter(
                                class_name=current_class.class_name,
                                grade_level=target_grade_level
                            ).first()

                            if not target_class_obj and auto_create_classes:
                                # 如果目標班級不存在且允許自動創建，則創建新班級
                                target_class_obj = Class.objects.create(
                                    class_name=current_class.class_name,
                                    grade_level=target_grade_level
                                )
                                messages.info(request, f"已自动创建班级：{target_grade_level}{current_class.class_name}。")
                            elif not target_class_obj and not auto_create_classes:
                                errors.append(f"学生 {student.name} (学号: {student.student_id}) 所在的班级 '{current_class.class_name}' 在目标年级 '{target_grade_level}' 中不存在，且未启用自动创建。跳过升级。")
                                continue # 跳過此學生

                            if target_class_obj:
                                student.current_class = target_class_obj
                                student.save()
                                updated_count += 1
                        else:
                            errors.append(f"学生 {student.name} (学号: {student.student_id}) 当前没有班级，跳过升级。")
                    except Exception as e:
                        errors.append(f"学生 {student.name} (学号: {student.student_id}) 升年级失败：{e}")
            
            if updated_count > 0:
                messages.success(request, f"成功将 {updated_count} 名学生升入 {target_grade_level}。")
            
            if errors:
                for err in errors:
                    messages.warning(request, err)
                messages.error(request, "部分学生升年级失败，请检查警告信息。")
            
            return redirect('student_list') # 升級後導回學生列表頁面
        else:
            # 表單驗證失敗
            messages.error(request, "表单提交有误，请检查。")
            return render(request, 'students/batch_promote_grade_form.html', {'form': form, 'title': '批量升年级'})
    else:
        form = BatchPromoteGradeForm()
    return render(request, 'students/batch_promote_grade_form.html', {'form': form, 'title': '批量升年级'})

# 批量畢業 (PRD 3.1.7）
@require_POST # 確保這個 View 只接受 POST 請求
def student_batch_graduate(request):
    selected_student_ids = request.POST.getlist('selected_students') # 獲取選中的學生 ID 列表

    if not selected_student_ids:
        messages.warning(request, "没有选择任何学生进行批量毕业操作。")
        return redirect('student_list')
    
    updated_count = 0
    
    try:
        with transaction.atomic(): # 使用事務，確保操作的原子性
            # 獲取所有選中的學生對象
            students_to_graduate = Student.objects.filter(pk__in=selected_student_ids)
            
            # 將這些學生的狀態更新為 '畢業'，並設定畢業日期為當前日期
            # 我們只更新那些狀態不是 '畢業' 的學生，以避免不必要的資料庫寫入
            updated_count = students_to_graduate.exclude(status='畢業').update(
                status='畢業',
                graduation_date=timezone.now().date() # 設定為今天的日期
            )
            
            # 如果有學生已經是畢業狀態，但仍然被選中，這不會再次更新
            # 但我們可以向用戶確認他們確實被包含在操作中
            already_graduated_count = students_to_graduate.filter(status='畢業').count()

            messages.success(request, f"成功將 {updated_count} 名學生設置為『畢業』狀態。")
            if already_graduated_count > 0:
                messages.info(request, f"其中有 {already_graduated_count} 名學生已是『畢業』狀態，無需重複操作。")

    except Exception as e:
        messages.error(request, f"批量畢業操作失敗：{e}")
    
    return redirect('student_list') # 操作完成後導回學生列表頁面
from django.contrib import admin
from .models import Class, Student, Exam, Subject, Score

# 在這裡註冊你的模型
admin.site.register(Class)
admin.site.register(Student)
admin.site.register(Exam)
admin.site.register(Subject)
admin.site.register(Score)
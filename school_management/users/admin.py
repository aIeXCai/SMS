from django.contrib import admin
from .models import CustomUser, Role

class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff')
    filter_horizontal = ('roles', 'groups', 'user_permissions')

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Role)

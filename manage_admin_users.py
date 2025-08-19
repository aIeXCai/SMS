#!/usr/bin/env python3
"""
Django 管理员账号管理脚本
用于查看、创建和重置Django管理员账号
"""

import os
import sys
import django
from getpass import getpass

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')
django.setup()

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password

def list_admin_users():
    """列出所有管理员用户"""
    print("=" * 60)
    print("Django 管理员账号列表")
    print("=" * 60)
    
    users = User.objects.all()
    if not users:
        print("❌ 没有找到任何用户账号")
        return False
    
    for i, user in enumerate(users, 1):
        print(f"\n👤 用户 {i}:")
        print(f"   用户名: {user.username}")
        print(f"   邮箱: {user.email or '未设置'}")
        print(f"   超级用户: {'✅ 是' if user.is_superuser else '❌ 否'}")
        print(f"   员工权限: {'✅ 是' if user.is_staff else '❌ 否'}")
        print(f"   账号状态: {'✅ 激活' if user.is_active else '❌ 禁用'}")
        print(f"   创建时间: {user.date_joined.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   最后登录: {user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else '从未登录'}")
        print("-" * 40)
    
    return True

def create_superuser_interactive():
    """交互式创建超级用户"""
    print("\n" + "=" * 60)
    print("创建Django超级用户")
    print("=" * 60)
    
    try:
        # 获取用户名
        while True:
            username = input("请输入用户名: ").strip()
            if not username:
                print("❌ 用户名不能为空")
                continue
            if User.objects.filter(username=username).exists():
                print(f"❌ 用户名 '{username}' 已存在")
                continue
            break
        
        # 获取邮箱
        while True:
            email = input("请输入邮箱 (可选，直接回车跳过): ").strip()
            if not email:
                break
            if '@' not in email:
                print("❌ 请输入有效的邮箱地址")
                continue
            break
        
        # 获取密码
        while True:
            password1 = getpass("请输入密码: ")
            if not password1:
                print("❌ 密码不能为空")
                continue
            
            password2 = getpass("请再次输入密码: ")
            if password1 != password2:
                print("❌ 两次输入的密码不一致")
                continue
            
            # 验证密码强度
            try:
                validate_password(password1)
                break
            except ValidationError as e:
                print("❌ 密码验证失败:")
                for error in e.messages:
                    print(f"   • {error}")
                continue
        
        # 创建用户
        user = User.objects.create_superuser(
            username=username,
            email=email if email else '',
            password=password1
        )
        
        print("\n✅ 超级用户创建成功!")
        print(f"   用户名: {user.username}")
        print(f"   邮箱: {user.email or '未设置'}")
        print(f"   管理界面: http://127.0.0.1:8000/admin/")
        
        return user
        
    except KeyboardInterrupt:
        print("\n\n❌ 操作已取消")
        return None
    except Exception as e:
        print(f"\n❌ 创建用户失败: {e}")
        return None

def reset_user_password():
    """重置用户密码"""
    print("\n" + "=" * 60)
    print("重置用户密码")
    print("=" * 60)
    
    users = User.objects.all()
    if not users:
        print("❌ 没有找到任何用户")
        return False
    
    # 显示用户列表
    print("\n现有用户:")
    for i, user in enumerate(users, 1):
        print(f"  {i}. {user.username} ({'超级用户' if user.is_superuser else '普通用户'})")
    
    try:
        # 选择用户
        while True:
            choice = input(f"\n请选择要重置密码的用户 (1-{len(users)}): ").strip()
            try:
                index = int(choice) - 1
                if 0 <= index < len(users):
                    selected_user = users[index]
                    break
                else:
                    print("❌ 请输入有效的数字")
            except ValueError:
                print("❌ 请输入数字")
        
        print(f"\n选择的用户: {selected_user.username}")
        
        # 获取新密码
        while True:
            password1 = getpass("请输入新密码: ")
            if not password1:
                print("❌ 密码不能为空")
                continue
            
            password2 = getpass("请再次输入新密码: ")
            if password1 != password2:
                print("❌ 两次输入的密码不一致")
                continue
            
            # 验证密码强度
            try:
                validate_password(password1, selected_user)
                break
            except ValidationError as e:
                print("❌ 密码验证失败:")
                for error in e.messages:
                    print(f"   • {error}")
                continue
        
        # 重置密码
        selected_user.set_password(password1)
        selected_user.save()
        
        print(f"\n✅ 用户 '{selected_user.username}' 的密码已重置成功!")
        return True
        
    except KeyboardInterrupt:
        print("\n\n❌ 操作已取消")
        return False
    except Exception as e:
        print(f"\n❌ 重置密码失败: {e}")
        return False

def create_quick_admin():
    """快速创建默认管理员账号"""
    print("\n" + "=" * 60)
    print("快速创建默认管理员")
    print("=" * 60)
    
    default_username = "admin"
    default_password = "admin123456"
    default_email = "admin@sms.local"
    
    if User.objects.filter(username=default_username).exists():
        print(f"❌ 用户名 '{default_username}' 已存在")
        return False
    
    try:
        user = User.objects.create_superuser(
            username=default_username,
            email=default_email,
            password=default_password
        )
        
        print("✅ 默认管理员账号创建成功!")
        print(f"   用户名: {default_username}")
        print(f"   密码: {default_password}")
        print(f"   邮箱: {default_email}")
        print(f"   管理界面: http://127.0.0.1:8000/admin/")
        print("\n⚠️  请在生产环境中修改默认密码!")
        
        return user
        
    except Exception as e:
        print(f"❌ 创建默认管理员失败: {e}")
        return False

def main():
    """主菜单"""
    print("Django 管理员账号管理工具")
    print("当前时间:", __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    
    while True:
        # 显示现有用户
        has_users = list_admin_users()
        
        print("\n" + "=" * 60)
        print("操作菜单")
        print("=" * 60)
        print("1. 创建超级用户 (交互式)")
        print("2. 快速创建默认管理员 (admin/admin123456)")
        print("3. 重置用户密码")
        print("4. 刷新用户列表")
        print("5. 退出")
        
        if has_users:
            print("\n💡 管理界面地址: http://127.0.0.1:8000/admin/")
        
        try:
            choice = input("\n请选择操作 (1-5): ").strip()
            
            if choice == '1':
                create_superuser_interactive()
            elif choice == '2':
                create_quick_admin()
            elif choice == '3':
                if has_users:
                    reset_user_password()
                else:
                    print("❌ 没有用户可以重置密码，请先创建用户")
            elif choice == '4':
                continue  # 刷新列表
            elif choice == '5':
                print("\n👋 再见!")
                break
            else:
                print("❌ 请输入有效的选项 (1-5)")
                
        except KeyboardInterrupt:
            print("\n\n👋 再见!")
            break
        except Exception as e:
            print(f"\n❌ 操作失败: {e}")
        
        input("\n按回车键继续...")

if __name__ == "__main__":
    main()

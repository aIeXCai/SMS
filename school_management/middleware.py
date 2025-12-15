"""
自定义认证中间件，用于处理从前端传递的JWT token
"""
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
import logging

logger = logging.getLogger(__name__)

class JWTAuthenticationMiddleware:
    """
    中间件：从请求头中提取JWT token并进行用户认证
    这样Django模板就可以访问到已认证的用户信息
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()

    def __call__(self, request):
        # 如果用户还未认证，或者是AnonymousUser，尝试从JWT token中获取用户
        if not request.user.is_authenticated or request.user.is_anonymous:
            redirect_response = self.authenticate_via_jwt(request)
            if redirect_response:
                return redirect_response
        
        response = self.get_response(request)
        return response

    def authenticate_via_jwt(self, request):
        """
        尝试通过JWT token认证用户
        支持从Authorization头部或URL参数中获取token
        """
        try:
            # 首先尝试从URL参数获取token（用于前端跳转后端的场景）
            token_from_url = request.GET.get('token')
            token_from_cookie = request.COOKIES.get('jwt_token')
            
            token_to_use = token_from_url or token_from_cookie
            
            if token_to_use:
                # 手动构造Authorization头
                request.META['HTTP_AUTHORIZATION'] = f'Bearer {token_to_use}'
            
            # 使用DRF的JWT认证器
            auth_result = self.jwt_auth.authenticate(request)
            
            if auth_result:
                user, token = auth_result
                # 强制设置用户到request中，覆盖任何现有的认证状态
                request.user = user
                
                # 如果token来自URL参数，重定向到清理后的URL以避免token暴露
                if token_from_url and request.path == '/':
                    from django.shortcuts import redirect
                    response = redirect('/')
                    # 设置cookie来保持认证状态
                    response.set_cookie('jwt_token', token_from_url, 
                                      max_age=3600,  # 1小时
                                      httponly=True, 
                                      secure=False)  # 开发环境设为False
                    return response
            
        except InvalidToken:
            pass  # 静默处理无效token
        except Exception as e:
            logger.error(f"JWT认证过程中出现错误: {str(e)}")
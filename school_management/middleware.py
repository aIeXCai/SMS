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
        # 1. 如果 URL 中包含 token，说明是显式的 SSO 跳转，优先级最高
        # 这种情况下，我们强制使用 JWT 进行认证，并更新 Session
        if request.GET.get('token'):
            redirect_response = self.authenticate_via_jwt(request)
            if redirect_response:
                return redirect_response
        
        # 2. 检查 Cookie 中的 JWT Token
        # 如果 Cookie 中有 Token，我们需要验证它是否与当前 Session 用户一致
        # 如果不一致（例如 Session 是 Admin，但 Cookie 是 Manager），通常意味着前端切换了用户
        # 此时我们应该优先信任前端的状态（因为它是主入口）
        elif request.COOKIES.get('jwt_token'):
             self.authenticate_via_jwt(request)
             
        # 3. 如果没有 JWT Token，则保持原有的 Session 状态（如果有）
        # 这允许纯 Django Admin 的正常使用

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
                
                # 关键修改：如果 JWT 用户与当前 Session 用户不一致，强制更新 Session
                if request.user != user:
                    # 指定 backend 以便 login 函数能正常工作
                    user.backend = 'django.contrib.auth.backends.ModelBackend'
                    login(request, user)
                
                # 确保 request.user 是最新的
                request.user = user
                
                # 后端现为 API-only，不再执行页面重定向。
                # 如需清理 URL token，请在前端路由层处理。
            
        except InvalidToken:
            # 如果 Token 无效（过期或错误），且当前有 Session 登录
            # 我们可能需要考虑是否要登出 Session？
            # 暂时保持保守策略：只记录日志，不强制登出 Session，以免影响 Admin 使用
            pass  
        except Exception as e:
            logger.error(f"JWT认证过程中出现错误: {str(e)}")
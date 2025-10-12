from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import UserSerializer

# Create your views here.

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    获取当前登录用户的信息。
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

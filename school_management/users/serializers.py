from rest_framework import serializers
from .models import CustomUser


class CurrentUserSerializer(serializers.ModelSerializer):
    managed_grade = serializers.CharField(read_only=True, required=False)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'managed_grade',
        ]
        extra_kwargs = {
            'managed_grade': {'read_only': True},
        }

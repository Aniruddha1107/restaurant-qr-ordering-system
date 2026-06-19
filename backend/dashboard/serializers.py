from rest_framework import serializers
from users.models import User

class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'role']

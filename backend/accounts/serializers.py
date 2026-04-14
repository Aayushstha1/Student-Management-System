from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db import transaction
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model
    """
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = User
        # Explicitly exclude the password field to ensure it is never returned
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'address', 'profile_picture', 'is_active', 'date_joined', 'password']
        read_only_fields = ['id', 'date_joined']

    def to_representation(self, instance):
        """Ensure password is never present in serialized output even if model changes."""
        data = super().to_representation(instance)
        data.pop('password', None)
        return data
    
    def update(self, instance, validated_data):
        # Handle password update
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new users
    """
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'role', 'phone', 'address', 'profile_picture', 'password', 'password_confirm']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login
    """
    username = serializers.CharField()
    password = serializers.CharField()
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if not (username and password):
            raise serializers.ValidationError('Must include username and password')

        user = authenticate(username=username, password=password)
        if user:
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
            return attrs

        # Parent login flow: enrollment number as both username & password
        try:
            request = self.context.get('request')
        except Exception:
            request = None
        parent_login = False
        if request is not None:
            parent_login = bool(request.data.get('parent_login'))

        if parent_login:
            if username != password:
                raise serializers.ValidationError('Enrollment number must be used as both username and password.')

            # Lazy import to avoid circular deps at import time
            from students.models import Student
            from parents.models import ParentProfile

            student = Student.objects.filter(student_id=username).first()
            if not student:
                student = Student.objects.filter(admission_number=username).first()
            if not student:
                raise serializers.ValidationError('Invalid enrollment number')

            enrollment = student.student_id
            user = User.objects.filter(username=enrollment).first()
            if user and user.role != 'parent':
                raise serializers.ValidationError('Enrollment number is already used by another account.')

            if not user:
                with transaction.atomic():
                    user = User.objects.create_user(
                        username=enrollment,
                        password=enrollment,
                        role='parent',
                        first_name=student.father_name or 'Parent',
                        last_name='',
                    )
            else:
                if not user.is_active:
                    raise serializers.ValidationError('User account is disabled')
                if not user.check_password(enrollment):
                    user.set_password(enrollment)
                    user.save(update_fields=['password'])

            # Ensure parent profile exists
            try:
                profile, created = ParentProfile.objects.get_or_create(
                    user=user,
                    defaults={'student': student, 'relation': 'guardian'},
                )
                if not created and profile.student_id != student.id:
                    profile.student = student
                    profile.save(update_fields=['student'])
            except Exception:
                pass

            attrs['user'] = user
            return attrs

        raise serializers.ValidationError('Invalid credentials')


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializer for password change
    """
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    new_password_confirm = serializers.CharField()
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError("New passwords don't match")
        return attrs

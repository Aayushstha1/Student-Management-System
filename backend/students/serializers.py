from rest_framework import serializers
from .models import Student, StudentPasswordResetRequest, StudentEmailChangeRequest, ConsentRequest
from accounts.models import User


class StudentSerializer(serializers.ModelSerializer):
    """
    Serializer for Student model
    """
    user = serializers.StringRelatedField(read_only=True)
    user_details = serializers.SerializerMethodField()
    qr_code_data = serializers.SerializerMethodField()
    qr_code = serializers.SerializerMethodField()
    qr_code_url = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        # Explicit list to avoid accidentally exposing fields like internal password
        fields = [
            'id', 'student_id', 'admission_number', 'admission_date',
            'user', 'user_details', 'date_of_birth', 'gender', 'blood_group',
            'father_name', 'mother_name', 'guardian_contact',
            'current_class', 'current_section', 'roll_number', 'qr_code', 'qr_code_url', 'qr_code_data',
            'profile_picture', 'profile_picture_url',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['student_id', 'admission_number', 'qr_code', 'created_at', 'updated_at']
    
    def get_user_details(self, obj):
        # Explicitly return only non-sensitive user fields and be defensive
        try:
            profile_picture_url = None
            try:
                if obj.user.profile_picture:
                    profile_picture_url = obj.user.profile_picture.url
            except Exception:
                profile_picture_url = None

            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'email': obj.user.email,
                'first_name': obj.user.first_name,
                'last_name': obj.user.last_name,
                'phone': obj.user.phone,
                'profile_picture': profile_picture_url,
            }
        except Exception:
            # If user relation is broken, return minimal safe info
            return {
                'id': None,
                'username': None,
                'email': None,
                'first_name': None,
                'last_name': None,
                'phone': None,
                'profile_picture': None,
            }
    
    def get_qr_code_data(self, obj):
        try:
            return obj.get_qr_code_data()
        except Exception:
            return {}

    def get_qr_code(self, obj):
        # Return a safe relative or absolute URL string for the image
        if not obj.qr_code:
            return None
        try:
            return obj.qr_code.url
        except Exception:
            return None

    def get_qr_code_url(self, obj):
        # Return absolute URL when request context is available
        try:
            url = None
            if obj.qr_code:
                try:
                    url = obj.qr_code.url
                except Exception:
                    url = None
            if not url:
                return None
            if obj.updated_at:
                sep = '&' if '?' in url else '?'
                url = f"{url}{sep}v={int(obj.updated_at.timestamp())}"
            request = self.context.get('request') if hasattr(self, 'context') else None
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None

    def get_profile_picture_url(self, obj):
        # Return profile picture URL if it exists
        try:
            if obj.profile_picture:
                url = obj.profile_picture.url
                request = self.context.get('request') if hasattr(self, 'context') else None
                if request:
                    return request.build_absolute_uri(url)
                return url
            return None
        except Exception:
            return None


from django.db import IntegrityError, transaction

class StudentCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating students with user account
    """
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Student
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name', 'phone',
            'admission_date', 'date_of_birth', 'gender', 'blood_group',
            'father_name', 'mother_name', 'guardian_contact',
            'current_class', 'current_section', 'roll_number'
        ]

    def validate(self, attrs):
        username = attrs.get('username')
        email = attrs.get('email')
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({'username': 'A user with that username already exists.'})
        if email and User.objects.filter(email=email).exists():
            raise serializers.ValidationError({'email': 'A user with that email already exists.'})
        return attrs
    
    def create(self, validated_data):
        # Create user account first
        user_data = {
            'username': validated_data.pop('username'),
            'email': validated_data.pop('email'),
            'password': validated_data.pop('password'),
            'first_name': validated_data.pop('first_name'),
            'last_name': validated_data.pop('last_name'),
            'role': 'student',
        }
        
        if 'phone' in validated_data:
            user_data['phone'] = validated_data.pop('phone')

        # Use a transaction to avoid partial creations and handle integrity errors
        try:
            with transaction.atomic():
                user = User.objects.create_user(**user_data)
                # Create student profile
                validated_data['user'] = user
                student = Student.objects.create(**validated_data)
                return student
        except IntegrityError as e:
            # Convert DB integrity errors into serializer validation errors for client
            raise serializers.ValidationError({'detail': 'A user with that username or email already exists.'})


class StudentSearchSerializer(serializers.Serializer):
    """
    Serializer for student search
    """
    query = serializers.CharField(max_length=100)
    class_filter = serializers.CharField(max_length=20, required=False)


class StudentPasswordResetRequestCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    class_name = serializers.CharField(write_only=True)
    father_name = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)

    class Meta:
        model = StudentPasswordResetRequest
        fields = [
            'id', 'username', 'class_name', 'father_name', 'email',
            'status', 'requested_at'
        ]
        read_only_fields = ['status', 'requested_at']

    def validate(self, attrs):
        username = (attrs.get('username') or '').strip()
        class_name = (attrs.get('class_name') or '').strip()
        father_name = (attrs.get('father_name') or '').strip()
        email = (attrs.get('email') or '').strip()

        attrs['username'] = username
        attrs['class_name'] = class_name
        attrs['father_name'] = father_name
        attrs['email'] = email

        student = None
        if username and class_name and father_name and email:
            try:
                student = Student.objects.select_related('user').get(
                    user__username__iexact=username,
                    current_class__iexact=class_name,
                    father_name__iexact=father_name,
                    user__email__iexact=email,
                )
            except Student.DoesNotExist:
                student = None

        attrs['student'] = student
        return attrs

    def create(self, validated_data):
        student = validated_data.pop('student', None)
        return StudentPasswordResetRequest.objects.create(student=student, **validated_data)


class StudentPasswordResetRequestSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_name = serializers.SerializerMethodField()
    student_email = serializers.EmailField(source='student.user.email', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    is_matched = serializers.SerializerMethodField()

    class Meta:
        model = StudentPasswordResetRequest
        fields = [
            'id', 'username', 'class_name', 'father_name', 'email',
            'status', 'requested_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_name',
            'note',
            'student', 'student_id', 'student_name', 'student_email', 'student_class', 'student_section',
            'is_matched',
        ]
        read_only_fields = ['requested_at', 'reviewed_at', 'reviewed_by', 'student']

    def get_student_name(self, obj):
        try:
            if obj.student and obj.student.user:
                return obj.student.user.get_full_name()
        except Exception:
            return None
        return None

    def get_is_matched(self, obj):
        return bool(obj.student_id)


class StudentEmailChangeRequestCreateSerializer(serializers.ModelSerializer):
    new_email = serializers.EmailField()

    class Meta:
        model = StudentEmailChangeRequest
        fields = ['id', 'new_email', 'status', 'requested_at']
        read_only_fields = ['status', 'requested_at']

    def validate_new_email(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('New email is required.')
        user = getattr(self.context.get('request'), 'user', None)
        if user and user.email and user.email.lower() == value.lower():
            raise serializers.ValidationError('New email must be different from current email.')
        qs = User.objects.filter(email__iexact=value)
        if user:
            qs = qs.exclude(pk=user.pk)
        if qs.exists():
            raise serializers.ValidationError('A user with that email already exists.')
        return value


class StudentEmailChangeRequestSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    class_name = serializers.CharField(source='student.current_class', read_only=True)
    section = serializers.CharField(source='student.current_section', read_only=True)
    current_email = serializers.EmailField(source='student.user.email', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = StudentEmailChangeRequest
        fields = [
            'id',
            'student',
            'student_id',
            'student_name',
            'class_name',
            'section',
            'current_email',
            'new_email',
            'status',
            'requested_at',
            'reviewed_at',
            'reviewed_by',
            'reviewed_by_name',
            'note',
        ]
        read_only_fields = ['requested_at', 'reviewed_at', 'reviewed_by', 'student']

class ConsentRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    class_name = serializers.CharField(source='student.current_class', read_only=True)
    section = serializers.CharField(source='student.current_section', read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ConsentRequest
        fields = [
            'id',
            'student',
            'student_id',
            'student_name',
            'class_name',
            'section',
            'request_type',
            'title',
            'details',
            'start_date',
            'end_date',
            'location',
            'amount',
            'start_time',
            'end_time',
            'event_id',
            'status',
            'submitted_by',
            'submitted_by_name',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'rejection_reason',
            'created_at',
        ]
        read_only_fields = ['status', 'submitted_by', 'reviewed_by', 'reviewed_at', 'created_at']

    def get_submitted_by_name(self, obj):
        try:
            if obj.submitted_by:
                return obj.submitted_by.get_full_name() or obj.submitted_by.username
        except Exception:
            return None
        return None

    def get_reviewed_by_name(self, obj):
        try:
            if obj.reviewed_by:
                return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        except Exception:
            return None
        return None


class StudentProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for student profile view and edit (excludes sensitive fields)
    """
    user_id = serializers.IntegerField(read_only=True, source='user.id')
    username = serializers.CharField(read_only=True, source='user.username')
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    approved_cvs = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'admission_number', 'admission_date',
            'user_id', 'username', 'email', 'first_name', 'last_name', 'phone',
            'date_of_birth', 'gender', 'blood_group',
            'father_name', 'mother_name', 'guardian_contact',
            'current_class', 'current_section', 'roll_number',
            'profile_picture', 'profile_picture_url',
            'is_active', 'created_at', 'updated_at',
            'approved_cvs'
        ]
        read_only_fields = ['student_id', 'admission_number', 'is_active', 'created_at', 'updated_at']
    
    def get_profile_picture_url(self, obj):
        try:
            if obj.profile_picture:
                url = obj.profile_picture.url
                request = self.context.get('request') if hasattr(self, 'context') else None
                if request:
                    return request.build_absolute_uri(url)
                return url
            return None
        except Exception:
            return None

    def get_approved_cvs(self, obj):
        try:
            from .models import CV
            request = self.context.get('request') if hasattr(self, 'context') else None
            qs = CV.objects.filter(owner=obj.user, approval_status='approved').order_by('-is_primary', '-approved_at', '-created_at')
            results = []
            for cv in qs:
                file_url = None
                project_file_url = None
                if cv.file:
                    try:
                        file_url = cv.file.url
                        if request:
                            file_url = request.build_absolute_uri(file_url)
                    except Exception:
                        file_url = None
                if cv.project_file:
                    try:
                        project_file_url = cv.project_file.url
                        if request:
                            project_file_url = request.build_absolute_uri(project_file_url)
                    except Exception:
                        project_file_url = None
                avg = None
                count = 0
                try:
                    avg = cv.average_rating.get('average')
                    count = cv.average_rating.get('count')
                except Exception:
                    avg = None
                    count = 0
                results.append({
                    'id': cv.id,
                    'title': cv.title,
                    'summary': cv.summary,
                    'file_url': file_url,
                    'project_file_url': project_file_url,
                    'is_primary': cv.is_primary,
                    'approved_at': cv.approved_at,
                    'average_rating': avg,
                    'ratings_count': count,
                })
            return results
        except Exception:
            return []


class StudentProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating student profile (allows profile picture upload)
    """
    class Meta:
        model = Student
        fields = [
            'date_of_birth', 'gender', 'blood_group',
            'father_name', 'mother_name', 'guardian_contact',
            'profile_picture'
        ]


# ------------------ CV Serializers ------------------
from .models import CV

class CVSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)
    owner_id = serializers.IntegerField(read_only=True, source='owner.id')
    approved_by = serializers.StringRelatedField(read_only=True)
    approved_by_id = serializers.IntegerField(read_only=True, source='approved_by.id')
    file_url = serializers.SerializerMethodField()
    project_file_url = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    ratings_count = serializers.SerializerMethodField()
    user_rating = serializers.SerializerMethodField()

    class Meta:
        model = CV
        fields = [
            'id',
            'owner', 'owner_id',
            'title', 'summary', 'education', 'experience', 'skills',
            'projects', 'certifications', 'languages', 'hobbies',
            'file', 'file_url', 'project_file', 'project_file_url',
            'is_primary',
            'approval_status', 'approved_by', 'approved_by_id', 'approved_at', 'rejection_reason',
            'created_at', 'updated_at',
            'average_rating', 'ratings_count', 'user_rating'
        ]
        read_only_fields = [
            'owner', 'owner_id',
            'approval_status', 'approved_by', 'approved_by_id', 'approved_at', 'rejection_reason',
            'created_at', 'updated_at'
        ]

    def get_file_url(self, obj):
        try:
            if obj.file:
                request = self.context.get('request') if hasattr(self, 'context') else None
                url = obj.file.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            return None
        except Exception:
            return None

    def get_project_file_url(self, obj):
        try:
            if obj.project_file:
                request = self.context.get('request') if hasattr(self, 'context') else None
                url = obj.project_file.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            return None
        except Exception:
            return None

    def get_average_rating(self, obj):
        try:
            return obj.average_rating.get('average')
        except Exception:
            return None

    def get_ratings_count(self, obj):
        try:
            return obj.average_rating.get('count')
        except Exception:
            return 0

    def get_user_rating(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None
        try:
            rating = obj.ratings.filter(rater=user).first()
            if rating:
                return {'id': rating.id, 'score': rating.score, 'comment': rating.comment}
            return None
        except Exception:
            return None

class CVCreateUpdateSerializer(serializers.ModelSerializer):
    """Used for create/update to accept file uploads and is_primary flag."""
    class Meta:
        model = CV
        fields = [
            'title', 'summary', 'education', 'experience', 'skills',
            'projects', 'certifications', 'languages', 'hobbies',
            'file', 'project_file', 'is_primary'
        ]


class CVRatingSerializer(serializers.ModelSerializer):
    rater = serializers.StringRelatedField(read_only=True)
    rater_id = serializers.IntegerField(source='rater.id', read_only=True)

    class Meta:
        from students.cv import CVRating
        model = CVRating
        fields = ['id', 'cv', 'rater', 'rater_id', 'score', 'comment', 'created_at', 'updated_at']
        read_only_fields = ['rater', 'rater_id', 'created_at', 'updated_at']

    def validate_score(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Score must be between 1 and 5')
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['rater'] = user
        # Enforce rater role should be admin, teacher, or student (not owner)
        cv = validated_data['cv']
        if user.role not in ['admin', 'teacher', 'student']:
            raise serializers.ValidationError('You are not allowed to rate CVs')
        if user == cv.owner:
            raise serializers.ValidationError('You cannot rate your own CV')
        if cv.approval_status != 'approved':
            raise serializers.ValidationError('Only approved CVs can be rated')
        # Ensure unique per user
        from students.cv import CVRating
        obj, created = CVRating.objects.update_or_create(cv=validated_data['cv'], rater=user, defaults={'score': validated_data.get('score'), 'comment': validated_data.get('comment', '')})
        return obj


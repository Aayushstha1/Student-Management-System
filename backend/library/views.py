from rest_framework import generics, permissions, status
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count
from django.db.models import Sum
from django.db.models import Q
import re
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Book, BookIssue, Fine, BookView
from .serializers import (
    BookSerializer,
    BookIssueSerializer,
    FineSerializer,
    BookViewSerializer
)
from students.models import Student
from notices.utils import dispatch_alert


class BookListCreateView(generics.ListCreateAPIView):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        qs = Book.objects.all()
        class_name = (self.request.query_params.get('class_name') or '').strip()
        class_param = (self.request.query_params.get('class') or '').strip()
        section_param = (self.request.query_params.get('section') or '').strip()
        candidates = set()
        def normalize_class(value):
            value = (value or '').strip()
            if not value:
                return ''
            value = re.sub(r'^(class|cls)\\s*[-:_]*\\s*', '', value, flags=re.IGNORECASE)
            value = re.sub(r'[/_-]+', ' ', value)
            value = re.sub(r'(\\d)([A-Za-z])', r'\\1 \\2', value)
            value = re.sub(r'\\s+', ' ', value).strip()
            return value

        def split_class_section(value):
            value = normalize_class(value)
            if not value:
                return ('', '')
            parts = value.split(' ')
            if value[:1].isdigit() and len(parts) > 1:
                last = parts[-1]
                if re.fullmatch(r'[A-Za-z]{1,3}', last):
                    return (' '.join(parts[:-1]).strip(), last.upper())
            return (value, '')

        def add_candidate(value):
            value = normalize_class(value)
            if not value:
                return
            no_space = value.replace(' ', '')
            with_underscore = value.replace(' ', '_')
            candidates.add(value)
            candidates.add(no_space)
            candidates.add(value.replace(' ', '-'))
            candidates.add(with_underscore)
            candidates.add(value.replace(' ', '/'))
            candidates.add(f"Class {value}")
            candidates.add(f"Class {no_space}")
            candidates.add(f"Class-{no_space}")
            candidates.add(f"Class_{no_space}")
            candidates.add(f"Class_{with_underscore}")
        if class_name:
            class_only, derived_section = split_class_section(class_name)
            add_candidate(class_name)
            if class_only and class_only != class_name:
                add_candidate(class_only)
            if section_param:
                add_candidate(f"{class_name} {section_param}")
                if class_only:
                    add_candidate(f"{class_only} {section_param}")
        if class_param:
            class_only, derived_section = split_class_section(class_param)
            add_candidate(class_param)
            if class_only and class_only != class_param:
                add_candidate(class_only)
            if section_param:
                add_candidate(f"{class_param} {section_param}")
                if class_only:
                    add_candidate(f"{class_only} {section_param}")
        if class_param and section_param:
            add_candidate(f"{class_param} {section_param}")
        if candidates:
            query = Q()
            for value in candidates:
                query |= Q(class_name__iexact=value)
            qs = qs.filter(query | Q(class_name__isnull=True) | Q(class_name__exact=''))
        subject_id = (self.request.query_params.get('subject_id') or self.request.query_params.get('subject') or '').strip()
        subject_code = (self.request.query_params.get('subject_code') or '').strip()
        subject_name = (self.request.query_params.get('subject_name') or '').strip()
        if subject_id:
            if subject_id.isdigit():
                qs = qs.filter(subject_id=int(subject_id))
            else:
                qs = qs.filter(subject__code__iexact=subject_id)
        elif subject_code:
            qs = qs.filter(subject__code__iexact=subject_code)
        elif subject_name:
            qs = qs.filter(subject__name__icontains=subject_name)
        return qs


class BookDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)


class BookIssueListCreateView(generics.ListCreateAPIView):
    queryset = BookIssue.objects.all()
    serializer_class = BookIssueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'role', None) == 'student':
            try:
                student = Student.objects.get(user=user)
                return BookIssue.objects.filter(student=student).select_related('book', 'student', 'teacher')
            except Student.DoesNotExist:
                return BookIssue.objects.none()
        qs = BookIssue.objects.select_related('book', 'student', 'teacher').all()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs


class BookIssueDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BookIssue.objects.all()
    serializer_class = BookIssueSerializer
    permission_classes = [permissions.IsAuthenticated]


class FineListCreateView(generics.ListCreateAPIView):
    queryset = Fine.objects.all()
    serializer_class = FineSerializer
    permission_classes = [permissions.IsAuthenticated]


class FineDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Fine.objects.all()
    serializer_class = FineSerializer
    permission_classes = [permissions.IsAuthenticated]


# ✅ STUDENT → RECORD BOOK VIEW
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def record_book_view(request, book_id):
    book = Book.objects.get(id=book_id)
    try:
        student = Student.objects.get(user=request.user)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    BookView.objects.get_or_create(book=book, student=student)
    return Response({'message': 'Book view recorded'})


# ✅ ADMIN → VIEW ALL BOOK VIEWS
@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_book_views(request):
    views = BookView.objects.select_related('book', 'student')
    serializer = BookViewSerializer(views, many=True)
    return Response(serializer.data)


# ✅ ADMIN → MOST VIEWED BOOKS
@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def most_viewed_books(request):
    data = (
        Book.objects
        .annotate(total_views=Count('views'))
        .values('title', 'total_views')
        .order_by('-total_views')
    )
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def library_stats(request):
    total_copies = Book.objects.aggregate(total=Sum('total_copies'))['total'] or 0
    available_copies = Book.objects.aggregate(total=Sum('available_copies'))['total'] or 0
    borrowed_copies = max(total_copies - available_copies, 0)

    today = timezone.now().date()
    overdue_count = BookIssue.objects.filter(
        status__in=['issued', 'overdue'],
        due_date__lt=today
    ).count()

    data = {
        'total_books': total_copies,
        'available_books': available_copies,
        'borrowed_books': borrowed_copies,
        'overdue_books': overdue_count,
    }

    if getattr(request.user, 'role', None) == 'student':
        try:
            student = Student.objects.get(user=request.user)
            my_borrowed = BookIssue.objects.filter(student=student, status__in=['issued', 'overdue']).count()
            my_overdue = BookIssue.objects.filter(student=student, status__in=['issued', 'overdue'], due_date__lt=today).count()
            data.update({'my_borrowed': my_borrowed, 'my_overdue': my_overdue})
        except Student.DoesNotExist:
            pass

    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def borrow_book(request):
    user = request.user
    if getattr(user, 'role', None) != 'student':
        raise PermissionDenied('Only students can borrow books')

    try:
        student = Student.objects.get(user=user)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    book_id = request.data.get('book_id')
    duration_days = request.data.get('duration_days', 14)
    try:
        duration_days = int(duration_days)
    except Exception:
        return Response({'detail': 'Invalid duration_days'}, status=status.HTTP_400_BAD_REQUEST)

    if duration_days not in [7, 14, 21, 30]:
        return Response({'detail': 'Duration must be 7, 14, 21 or 30 days'}, status=status.HTTP_400_BAD_REQUEST)

    book = Book.objects.filter(id=book_id).first()
    if not book:
        return Response({'detail': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    if book.available_copies <= 0:
        return Response({'detail': 'No copies available'}, status=status.HTTP_400_BAD_REQUEST)

    # Prevent duplicate active issue for same book
    existing = BookIssue.objects.filter(book=book, student=student, status__in=['issued', 'overdue']).first()
    if existing:
        return Response({'detail': 'You already borrowed this book'}, status=status.HTTP_400_BAD_REQUEST)

    issued_date = timezone.now().date()
    due_date = issued_date + timezone.timedelta(days=duration_days)

    issue = BookIssue.objects.create(
        book=book,
        student=student,
        issued_by=user,
        issued_date=issued_date,
        due_date=due_date,
        status='issued'
    )

    book.available_copies = max(book.available_copies - 1, 0)
    book.save(update_fields=['available_copies'])

    return Response(BookIssueSerializer(issue).data, status=status.HTTP_201_CREATED)


class LibraryStaffIssueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if getattr(user, 'role', None) not in ['admin', 'librarian']:
            raise PermissionDenied('Only library staff can issue books.')

        def parse_copy_numbers(value):
            if not value:
                return []
            raw = str(value)
            tokens = []
            for chunk in raw.replace('\n', ',').replace(';', ',').split(','):
                chunk = chunk.strip()
                if not chunk:
                    continue
                for sub in chunk.split():
                    sub = sub.strip()
                    if sub:
                        tokens.append(sub)
            seen = set()
            unique = []
            for t in tokens:
                if t in seen:
                    continue
                seen.add(t)
                unique.append(t)
            return unique

        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.select_related('user').get(pk=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        duration_days = request.data.get('duration_days', 14)
        try:
            duration_days = int(duration_days)
        except Exception:
            return Response({'detail': 'Invalid duration_days.'}, status=status.HTTP_400_BAD_REQUEST)

        if duration_days not in [7, 14, 21, 30]:
            return Response({'detail': 'Duration must be 7, 14, 21 or 30 days.'}, status=status.HTTP_400_BAD_REQUEST)

        book_ids = request.data.get('book_ids')
        book_numbers = request.data.get('book_numbers', '')
        tokens = []

        if isinstance(book_ids, list):
            tokens.extend([str(x).strip() for x in book_ids if str(x).strip()])

        if book_numbers:
            raw = str(book_numbers)
            parts = []
            for chunk in raw.replace('\n', ',').replace(';', ',').split(','):
                chunk = chunk.strip()
                if not chunk:
                    continue
                for sub in chunk.split():
                    sub = sub.strip()
                    if sub:
                        parts.append(sub)
            tokens.extend(parts)

        # De-duplicate while preserving order
        seen = set()
        ordered_tokens = []
        for t in tokens:
            if t in seen:
                continue
            seen.add(t)
            ordered_tokens.append(t)

        if not ordered_tokens:
            return Response({'detail': 'No book numbers provided.'}, status=status.HTTP_400_BAD_REQUEST)

        issued = []
        errors = []
        issued_date = timezone.now().date()
        due_date = issued_date + timezone.timedelta(days=duration_days)

        for token in ordered_tokens:
            book = None
            copy_number = None
            if token.isdigit():
                book = Book.objects.filter(id=int(token)).first()
            if not book:
                book = Book.objects.filter(isbn__iexact=token).first()
            if not book:
                candidates = Book.objects.filter(copy_numbers__icontains=token)
                matched = []
                for candidate in candidates:
                    numbers = parse_copy_numbers(candidate.copy_numbers)
                    if token in numbers:
                        matched.append(candidate)
                if len(matched) == 1:
                    book = matched[0]
                    copy_number = token
                elif len(matched) > 1:
                    errors.append({'token': token, 'error': 'Copy number matches multiple books'})
                    continue

            if not book:
                errors.append({'token': token, 'error': 'Book not found'})
                continue

            if book.available_copies <= 0:
                errors.append({'token': token, 'error': 'No copies available'})
                continue

            if copy_number:
                existing = BookIssue.objects.filter(
                    book=book,
                    copy_number=copy_number,
                    status__in=['issued', 'overdue']
                ).first()
                if existing:
                    errors.append({'token': token, 'error': 'This copy is already issued'})
                    continue

            existing = BookIssue.objects.filter(
                book=book,
                student=student,
                status__in=['issued', 'overdue']
            ).first()
            if existing:
                errors.append({'token': token, 'error': 'Already issued to this student'})
                continue

            issue = BookIssue.objects.create(
                book=book,
                student=student,
                issued_by=user,
                issued_date=issued_date,
                due_date=due_date,
                status='issued',
                copy_number=copy_number
            )
            book.available_copies = max(book.available_copies - 1, 0)
            book.save(update_fields=['available_copies'])
            issued.append(issue)

        if issued:
            try:
                titles = ', '.join([i.book.title for i in issued][:5])
                if len(issued) > 5:
                    titles = f"{titles} and {len(issued) - 5} more"
                dispatch_alert(
                    student.user,
                    'Library Book Issued',
                    f'{len(issued)} book(s) issued: {titles}',
                    link='/student/library'
                )
            except Exception:
                pass

        return Response({
            'issued': BookIssueSerializer(issued, many=True).data,
            'errors': errors,
            'student': {
                'id': student.id,
                'student_id': student.student_id,
                'name': student.user.get_full_name() if student.user else '',
                'class': student.current_class,
                'section': student.current_section,
            }
        }, status=status.HTTP_200_OK)

from django.urls import path
from . import views

app_name = 'students'

urlpatterns = [
    path('', views.StudentListCreateView.as_view(), name='student-list-create'),
    path('profile/', views.StudentProfileView.as_view(), name='student-profile'),
    path('public/<str:student_id>/', views.PublicStudentProfileView.as_view(), name='student-public-profile'),
    path('<int:pk>/', views.StudentDetailView.as_view(), name='student-detail'),
    path('<int:pk>/profile/', views.StudentProfileView.as_view(), name='student-admin-profile'),
    path('<int:pk>/profile-picture/', views.StudentProfilePictureUploadView.as_view(), name='student-profile-picture'),
    path('<int:pk>/qr-code/', views.StudentQRCodeView.as_view(), name='student-qr-code'),
    path('<int:pk>/reset-password/', views.reset_student_password, name='student-reset-password'),
    path('search/', views.StudentSearchView.as_view(), name='student-search'),
    path('consents/', views.ConsentRequestListCreateView.as_view(), name='consent-list-create'),
    path('consents/<int:pk>/approve/', views.ConsentRequestApproveView.as_view(), name='consent-approve'),
    path('consents/<int:pk>/reject/', views.ConsentRequestRejectView.as_view(), name='consent-reject'),
    path('consents/trip-events/', views.TripEventListCreateView.as_view(), name='trip-events'),
    path('password-reset-requests/', views.StudentPasswordResetRequestListCreateView.as_view(), name='student-password-reset-requests'),
    path('password-reset-requests/<int:pk>/approve/', views.StudentPasswordResetRequestApproveView.as_view(), name='student-password-reset-approve'),
    path('password-reset-requests/<int:pk>/reject/', views.StudentPasswordResetRequestRejectView.as_view(), name='student-password-reset-reject'),
    path('email-change-requests/', views.StudentEmailChangeRequestListCreateView.as_view(), name='student-email-change-requests'),
    path('email-change-requests/<int:pk>/approve/', views.StudentEmailChangeRequestApproveView.as_view(), name='student-email-change-approve'),
    path('email-change-requests/<int:pk>/reject/', views.StudentEmailChangeRequestRejectView.as_view(), name='student-email-change-reject'),
    # CV endpoints
    path('cvs/', views.CVListCreateView.as_view(), name='cv-list-create'),
    path('cvs/approved/', views.ApprovedCVListView.as_view(), name='cv-approved-list'),
    path('cvs/<int:pk>/', views.CVDetailView.as_view(), name='cv-detail'),
    path('cvs/<int:pk>/approval/', views.CVApprovalView.as_view(), name='cv-approval'),
    path('cvs/<int:pk>/rate/', views.CVRatingCreateView.as_view(), name='cv-rate'),
    path('cvs/<int:pk>/ratings/', views.CVRatingsListView.as_view(), name='cv-ratings-list'),
    path('cvs/ratings/<int:rating_pk>/', views.CVRatingDetailView.as_view(), name='cv-rating-detail'),
]

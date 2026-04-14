from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class CV(models.Model):
    """Curriculum Vitae created by a student, visible to admin and teachers (read-only for them)."""
    APPROVAL_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cvs')
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    education = models.TextField(blank=True)
    experience = models.TextField(blank=True)
    skills = models.TextField(blank=True)
    projects = models.TextField(blank=True)
    certifications = models.TextField(blank=True)
    languages = models.TextField(blank=True)
    hobbies = models.TextField(blank=True)
    file = models.FileField(upload_to='cvs/', null=True, blank=True)
    project_file = models.FileField(upload_to='cv_projects/', null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='approved_cvs', null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', '-created_at']

    def __str__(self):
        return f"{self.title} - {self.owner.get_full_name() or self.owner.username}"

    def save(self, *args, **kwargs):
        # Ensure only one primary CV per owner
        if self.is_primary:
            CV.objects.filter(owner=self.owner, is_primary=True).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


class CVRating(models.Model):
    """Rating left by teacher, admin, or student on a student's CV."""
    cv = models.ForeignKey(CV, on_delete=models.CASCADE, related_name='ratings')
    rater = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cv_ratings')
    score = models.IntegerField()  # expected 1-5
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('cv', 'rater')
        ordering = ['-created_at']

    def __str__(self):
        return f"CVRating({self.cv.id}, {self.rater.username}, {self.score})"


# Helper properties on CV
@property
def average_rating(self):
    agg = self.ratings.aggregate(avg=models.Avg('score'), count=models.Count('id'))
    return {
        'average': round(agg['avg'], 2) if agg['avg'] is not None else None,
        'count': agg['count']
    }

# Attach properties to CV dynamically (keeps model file small)
CV.average_rating = average_rating

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  PhotoLibrary,
  Upload,
  CheckCircle,
  Cancel,
  Pending,
  Delete,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const EventGallery = () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [events, setEvents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventId, setEventId] = useState('');
  const [imageFile, setImageFile] = useState(null);

  const token = localStorage.getItem('access_token') || localStorage.getItem('token');

  useEffect(() => {
    fetchEvents();
    fetchPhotos();
  }, []);

  const fetchEvents = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/events/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const results = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      setEvents(results);
    } catch (err) {
      // Not fatal for gallery display
      setEvents([]);
    }
  };

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API_BASE_URL}/events/gallery/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const results = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      setPhotos(results);
      setError('');
    } catch (err) {
      setError('Failed to load gallery photos');
    } finally {
      setLoading(false);
    }
  };

  const statusChip = (status) => {
    const map = {
      pending: { label: 'Pending', color: 'warning', icon: <Pending fontSize="small" /> },
      approved: { label: 'Approved', color: 'success', icon: <CheckCircle fontSize="small" /> },
      rejected: { label: 'Rejected', color: 'error', icon: <Cancel fontSize="small" /> },
    };
    const config = map[status] || map.pending;
    return <Chip size="small" icon={config.icon} label={config.label} color={config.color} />;
  };

  const handleUpload = async () => {
    if (!imageFile) {
      setError('Please select a photo to upload.');
      return;
    }
    try {
      setUploading(true);
      setError('');
      const formData = new FormData();
      if (title.trim()) formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (eventId) formData.append('event', eventId);
      formData.append('image', imageFile);

      await axios.post(`${API_BASE_URL}/events/gallery/`, formData, {
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(isAdmin ? 'Photo uploaded and approved.' : 'Photo submitted for approval.');
      setTitle('');
      setDescription('');
      setEventId('');
      setImageFile(null);
      fetchPhotos();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setUploading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleApproval = async (photo, action) => {
    try {
      let rejection_reason = '';
      if (action === 'reject') {
        rejection_reason = window.prompt('Rejection reason (optional):') || '';
      }
      await axios.patch(
        `${API_BASE_URL}/events/gallery/${photo.id}/approval/`,
        { action, rejection_reason },
        { headers: { Authorization: `Token ${token}` } },
      );
      fetchPhotos();
    } catch (err) {
      setError('Failed to update approval status');
    }
  };

  const handleDelete = async (photoId) => {
    if (!window.confirm('Delete this photo?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/events/gallery/${photoId}/`, {
        headers: { Authorization: `Token ${token}` },
      });
      fetchPhotos();
    } catch (err) {
      setError('Failed to delete photo');
    }
  };

  const approvedPhotos = useMemo(
    () => photos.filter((p) => p.approval_status === 'approved'),
    [photos],
  );
  const pendingPhotos = useMemo(
    () => photos.filter((p) => p.approval_status === 'pending'),
    [photos],
  );
  const myPhotos = useMemo(
    () => photos.filter((p) => p.uploaded_by === user?.id),
    [photos, user?.id],
  );

  return (
    <Box sx={{ bgcolor: '#f5f7fb', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        <Paper
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            color: 'white',
            background: 'linear-gradient(120deg, #0f172a, #1d4ed8)',
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <PhotoLibrary />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Event Gallery
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
            Students and teachers can upload event photos. Admin approves and publishes for everyone.
          </Typography>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Upload Event Photo
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Title (optional)"
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Event (optional)</InputLabel>
                <Select
                  label="Event (optional)"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>No event</em>
                  </MenuItem>
                  {events.map((evt) => (
                    <MenuItem key={evt.id} value={evt.id}>
                      {evt.title} ({evt.event_date})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<Upload />}
                sx={{ height: '56px' }}
              >
                Select Photo
                <input
                  hidden
                  accept="image/*"
                  type="file"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </Button>
              <Typography variant="caption" color="text.secondary">
                {imageFile ? imageFile.name : 'No file selected'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description (optional)"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Submit Photo'}
            </Button>
          </Box>
        </Paper>

        {isAdmin && (
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Pending Approvals
            </Typography>
            {pendingPhotos.length === 0 ? (
              <Typography color="text.secondary">No pending photos.</Typography>
            ) : (
              <Grid container spacing={2}>
                {pendingPhotos.map((photo) => (
                  <Grid item xs={12} md={4} key={photo.id}>
                    <Card>
                      <CardMedia component="img" height="200" image={photo.image_url} alt={photo.title || 'Event Photo'} />
                      <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          {statusChip(photo.approval_status)}
                          <Typography variant="subtitle2">{photo.title || 'Event Photo'}</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {photo.description || 'No description'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Uploaded by {photo.uploaded_by_name} ({photo.uploaded_by_role})
                        </Typography>
                        {photo.event_title && (
                          <Typography variant="caption" color="text.secondary">
                            Event: {photo.event_title} ({photo.event_date})
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions>
                        <Button size="small" variant="contained" onClick={() => handleApproval(photo, 'approve')}>
                          Approve
                        </Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => handleApproval(photo, 'reject')}>
                          Reject
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        )}

        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Approved Gallery
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : approvedPhotos.length === 0 ? (
            <Typography color="text.secondary">No approved photos yet.</Typography>
          ) : (
            <Grid container spacing={2}>
              {approvedPhotos.map((photo) => (
                <Grid item xs={12} sm={6} md={4} key={photo.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardMedia component="img" height="220" image={photo.image_url} alt={photo.title || 'Event Photo'} />
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        {statusChip(photo.approval_status)}
                        <Typography variant="subtitle2">{photo.title || 'Event Photo'}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {photo.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Uploaded by {photo.uploaded_by_name} ({photo.uploaded_by_role})
                      </Typography>
                      {photo.event_title && (
                        <Typography variant="caption" color="text.secondary">
                          Event: {photo.event_title} ({photo.event_date})
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {!isAdmin && (
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              My Submissions
            </Typography>
            {myPhotos.length === 0 ? (
              <Typography color="text.secondary">No submissions yet.</Typography>
            ) : (
              <Grid container spacing={2}>
                {myPhotos.map((photo) => (
                  <Grid item xs={12} md={4} key={photo.id}>
                    <Card>
                      <CardMedia component="img" height="200" image={photo.image_url} alt={photo.title || 'Event Photo'} />
                      <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          {statusChip(photo.approval_status)}
                          <Typography variant="subtitle2">{photo.title || 'Event Photo'}</Typography>
                        </Stack>
                        {photo.rejection_reason && photo.approval_status === 'rejected' && (
                          <Alert severity="error" sx={{ mb: 1 }}>
                            {photo.rejection_reason}
                          </Alert>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {photo.description || 'No description'}
                        </Typography>
                      </CardContent>
                      {photo.approval_status !== 'approved' && (
                        <CardActions>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => handleDelete(photo.id)}
                          >
                            Delete
                          </Button>
                        </CardActions>
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default EventGallery;

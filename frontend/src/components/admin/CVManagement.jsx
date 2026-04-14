import React, { useEffect, useState } from 'react';
import { Container, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, Button, CircularProgress, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Checkbox, Chip, Rating, Stack } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const CVManagement = () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editFile, setEditFile] = useState(null);
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [ratingsList, setRatingsList] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState('');
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => { fetchCVs(); }, []);

  const fetchCVs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const resp = await axios.get(`${API_BASE_URL}/students/cvs/`, { headers: { Authorization: `Token ${token}` } });
      const results = resp.data.results || resp.data;
      setCvs(results);
    } catch (err) {
      setError('Failed to load CVs');
    } finally { setLoading(false); }
  };

  const handleEditOpen = (cv) => {
    setEditing(cv);
    setEditTitle(cv.title || '');
    setEditSummary(cv.summary || '');
    setEditIsPrimary(!!cv.is_primary);
    setEditFile(null);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('summary', editSummary || '');
      formData.append('is_primary', editIsPrimary ? 'true' : 'false');
      if (editFile) formData.append('file', editFile);
      const resp = await axios.patch(`${API_BASE_URL}/students/cvs/${editing.id}/`, formData, { headers: { Authorization: `Token ${token}`, 'Content-Type': 'multipart/form-data' } });
      setEditOpen(false);
      fetchCVs();
    } catch (err) {
      setError('Failed to save changes');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this CV?')) return;
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/students/cvs/${id}/`, { headers: { Authorization: `Token ${token}` } });
      fetchCVs();
    } catch (err) {
      setError('Failed to delete CV');
    }
  };

  const handlePreview = (url) => {
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const openRatings = async (cv) => {
    try {
      setRatingsLoading(true);
      setRatingsError('');
      setRatingTarget(cv);
      setRatingScore(cv.user_rating?.score || 0);
      setRatingComment(cv.user_rating?.comment || '');
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const resp = await axios.get(`${API_BASE_URL}/students/cvs/${cv.id}/ratings/`, { headers: { Authorization: `Token ${token}` } });
      setRatingsList(resp.data || []);
      setRatingsOpen(true);
    } catch (err) {
      setRatingsError('Failed to load ratings');
    } finally {
      setRatingsLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingTarget) return;
    if (!ratingScore) {
      setRatingsError('Please select a rating');
      return;
    }
    try {
      setRatingSubmitting(true);
      setRatingsError('');
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/students/cvs/${ratingTarget.id}/rate/`,
        { score: ratingScore, comment: ratingComment || '' },
        { headers: { Authorization: `Token ${token}` } }
      );
      await openRatings(ratingTarget);
      fetchCVs();
    } catch (err) {
      setRatingsError(err.response?.data?.detail || err.response?.data?.error || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleApproval = async (cv, action) => {
    try {
      setError('');
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      let rejection_reason = '';
      if (action === 'reject') {
        rejection_reason = window.prompt('Enter rejection reason (optional):') || '';
      }
      await axios.patch(
        `${API_BASE_URL}/students/cvs/${cv.id}/approval/`,
        { action, rejection_reason },
        { headers: { Authorization: `Token ${token}` } }
      );
      fetchCVs();
    } catch (err) {
      setError('Failed to update approval status');
    }
  };

  const handleDeleteRating = async (ratingId) => {
    if (!window.confirm('Delete this rating?')) return;
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/students/cvs/ratings/${ratingId}/`, { headers: { Authorization: `Token ${token}` } });
      setRatingsList(ratingsList.filter((r) => r.id !== ratingId));
      fetchCVs();
    } catch (err) {
      setRatingsError('Failed to delete rating');
    }
  };

  if (loading) return <Container sx={{ mt: 6 }}><CircularProgress /></Container>;

  const statusChip = (status) => {
    const config = {
      pending: { label: 'Pending', color: 'warning' },
      approved: { label: 'Approved', color: 'success' },
      rejected: { label: 'Rejected', color: 'error' },
    };
    const item = config[status] || config.pending;
    return <Chip size="small" label={item.label} color={item.color} />;
  };

  return (
    <Container sx={{ py: 4 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Student CVs</Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Summary</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>File</TableCell>
              <TableCell>Avg Rating</TableCell>
              <TableCell>Ratings</TableCell>
              {(isAdmin || isTeacher) && <TableCell>Approval</TableCell>}
              {isAdmin && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {cvs.map(cv => (
              <TableRow key={cv.id}>
                <TableCell>{cv.owner}</TableCell>
                <TableCell>{cv.title}{cv.is_primary ? ' (Primary)' : ''}</TableCell>
                <TableCell>{cv.summary}</TableCell>
                <TableCell>{statusChip(cv.approval_status)}</TableCell>
                <TableCell>
                  {cv.file_url ? <Button href={cv.file_url} target="_blank">Download</Button> : '--'}
                  {cv.file_url && <Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={() => handlePreview(cv.file_url)}>Preview</Button>}
                </TableCell>
                <TableCell>{cv.average_rating ? cv.average_rating.toFixed(1) : '--'}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openRatings(cv)}>View Ratings</Button>
                </TableCell>
                {(isAdmin || isTeacher) && (
                  <TableCell>
                    {cv.approval_status === 'pending' && (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" onClick={() => handleApproval(cv, 'approve')}>Approve</Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => handleApproval(cv, 'reject')}>Reject</Button>
                      </Stack>
                    )}
                    {cv.approval_status === 'approved' && (
                      <Button size="small" variant="outlined" color="warning" onClick={() => handleApproval(cv, 'reject')}>Reject</Button>
                    )}
                    {cv.approval_status === 'rejected' && (
                      <Button size="small" variant="outlined" onClick={() => handleApproval(cv, 'approve')}>Approve</Button>
                    )}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell>
                    <IconButton onClick={() => handleEditOpen(cv)}><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(cv.id)}><DeleteIcon color="error" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Edit CV</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Summary" value={editSummary} onChange={(e) => setEditSummary(e.target.value)} multiline rows={4} sx={{ mb: 2 }} />
          <FormControlLabel control={<Checkbox checked={editIsPrimary} onChange={(e) => setEditIsPrimary(e.target.checked)} />} label="Set as primary" />
          <Button variant="contained" component="label" sx={{ ml: 2 }}>
            Upload New File
            <input hidden type="file" accept="application/pdf" onChange={(e) => setEditFile(e.target.files[0])} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Preview</DialogTitle>
        <DialogContent>
          {previewUrl ? (
            <object data={previewUrl} type="application/pdf" width="100%" height="600"> 
              <p>Your browser does not support PDFs. <a href={previewUrl}>Download</a></p>
            </object>
          ) : (
            <Typography>No file to preview</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ratingsOpen} onClose={() => setRatingsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>CV Ratings</DialogTitle>
        <DialogContent>
          {(isAdmin || isTeacher) && ratingTarget && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Your Rating for {ratingTarget.title}
              </Typography>
              <Rating value={ratingScore} onChange={(_, value) => setRatingScore(value)} />
              <TextField
                fullWidth
                label="Comment (optional)"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={handleSubmitRating}
                disabled={ratingSubmitting}
              >
                {ratingSubmitting ? 'Saving...' : 'Save Rating'}
              </Button>
            </Paper>
          )}
          {ratingsLoading ? (
            <CircularProgress />
          ) : ratingsError ? (
            <Alert severity="error">{ratingsError}</Alert>
          ) : ratingsList.length === 0 ? (
            <Typography>No ratings yet</Typography>
          ) : (
            ratingsList.map((r) => (
              <Paper key={r.id} sx={{ p: 2, mb: 1 }}>
                <Typography><strong>{r.rater}</strong> - {r.score}/5</Typography>
                <Typography variant="body2">{r.comment || 'No comment'}</Typography>
                {isAdmin && (
                  <Button size="small" color="error" sx={{ mt: 1 }} onClick={() => handleDeleteRating(r.id)}>Delete</Button>
                )}
              </Paper>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRatingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default CVManagement;

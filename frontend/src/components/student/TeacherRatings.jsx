import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Rating,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';

const TeacherRatings = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ratingInputs, setRatingInputs] = useState({});
  const [showLastComment, setShowLastComment] = useState({});

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/teachers/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setTeachers(list);

      if (Object.keys(ratingInputs).length === 0) {
        const initial = {};
        list.forEach((t) => {
          initial[t.id] = {
            score: t.user_rating?.score || 0,
            comment: '',
          };
        });
        setRatingInputs(initial);
      }
    } catch (err) {
      setError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleRatingChange = (teacherId, score) => {
    setRatingInputs((prev) => ({
      ...prev,
      [teacherId]: { ...prev[teacherId], score },
    }));
  };

  const handleCommentChange = (teacherId, comment) => {
    setRatingInputs((prev) => ({
      ...prev,
      [teacherId]: { ...prev[teacherId], comment },
    }));
  };

  const loadLastComment = (teacherId, comment) => {
    setRatingInputs((prev) => ({
      ...prev,
      [teacherId]: { ...prev[teacherId], comment: comment || '' },
    }));
  };

  const toggleLastComment = (teacherId) => {
    setShowLastComment((prev) => ({
      ...prev,
      [teacherId]: !prev[teacherId],
    }));
  };

  const submitRating = async (teacherId) => {
    const input = ratingInputs[teacherId] || {};
    if (!input.score) {
      setError('Please select a rating before submitting.');
      return;
    }
    try {
      await axios.post(`/teachers/${teacherId}/rate/`, {
        score: input.score,
        comment: input.comment || '',
      });
      setRatingInputs((prev) => ({
        ...prev,
        [teacherId]: { ...prev[teacherId], comment: '' },
      }));
      setShowLastComment((prev) => ({ ...prev, [teacherId]: false }));
      setSuccess('Rating submitted');
      setError('');
      setTimeout(() => {
        setSuccess('');
        window.location.reload();
      }, 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit rating');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Rate Teachers</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Grid container spacing={2}>
        {teachers.map((t) => (
          <Grid item xs={12} md={6} key={t.id}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">
                {t.user_details?.first_name} {t.user_details?.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t.department} • {t.designation}
              </Typography>
              <Box sx={{ mt: 2, mb: 1 }}>
                <Rating
                  value={ratingInputs[t.id]?.score || 0}
                  onChange={(_, value) => handleRatingChange(t.id, value)}
                />
              </Box>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Comment (optional)"
                value={ratingInputs[t.id]?.comment || ''}
                onChange={(e) => handleCommentChange(t.id, e.target.value)}
                sx={{ mb: 2 }}
              />
              {t.user_rating?.comment && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button size="small" variant="outlined" onClick={() => toggleLastComment(t.id)}>
                    {showLastComment[t.id] ? 'Hide Last Comment' : 'View Last Comment'}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => loadLastComment(t.id, t.user_rating?.comment)}
                  >
                    Edit Last Comment
                  </Button>
                </Box>
              )}
              {showLastComment[t.id] && t.user_rating?.comment && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t.user_rating.comment}
                </Alert>
              )}
              <Button variant="contained" onClick={() => submitRating(t.id)}>
                Submit Rating
              </Button>
            </Paper>
          </Grid>
        ))}
        {teachers.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography>No teachers found.</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default TeacherRatings;

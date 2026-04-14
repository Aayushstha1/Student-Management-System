import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Chip,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Link,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const statusColor = (status) => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    default:
      return 'warning';
  }
};

const LeaveLetters = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    attachment: null,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leave-requests-student'],
    queryFn: async () => (await axios.get('attendance/leaves/')).data,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.post('attendance/leaves/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests-student'] });
      setFormData({ start_date: '', end_date: '', reason: '', attachment: null });
      setSuccess('Leave request submitted for approval.');
      setError('');
    },
    onError: (err) => {
      const msg =
        typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : err.response?.data?.detail || 'Failed to submit leave request.';
      setError(msg);
      setSuccess('');
    },
  });

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, attachment: file }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!formData.start_date || !formData.end_date || !formData.reason) {
      setError('Start date, end date, and reason are required.');
      return;
    }
    const payload = new FormData();
    payload.append('start_date', formData.start_date);
    payload.append('end_date', formData.end_date);
    payload.append('reason', formData.reason);
    if (formData.attachment) {
      payload.append('attachment', formData.attachment);
    }
    createMutation.mutate(payload);
  };

  const leaveList = Array.isArray(leaves) ? leaves : leaves?.results || [];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Leave Letters
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Submit Leave Request
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Start Date"
                name="start_date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.start_date}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="End Date"
                name="end_date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.end_date}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button variant="outlined" component="label" fullWidth sx={{ height: '100%' }}>
                {formData.attachment ? `File: ${formData.attachment.name}` : 'Attach Letter (optional)'}
                <input type="file" hidden onChange={handleFileChange} />
              </Button>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason"
                name="reason"
                multiline
                rows={3}
                value={formData.reason}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button type="submit" variant="contained" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          My Leave Requests
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={30} />
          </Box>
        ) : leaveList.length === 0 ? (
          <Typography color="text.secondary">No leave requests yet.</Typography>
        ) : (
          <List>
            {leaveList.map((leave) => (
              <ListItem key={leave.id} divider alignItems="flex-start">
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </Typography>
                      <Chip size="small" label={leave.status} color={statusColor(leave.status)} />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {leave.reason}
                      </Typography>
                      {leave.rejection_reason && (
                        <Typography variant="body2" color="error">
                          Rejection: {leave.rejection_reason}
                        </Typography>
                      )}
                      {leave.attachment_url && (
                        <Link href={leave.attachment_url} target="_blank" rel="noreferrer">
                          View attachment
                        </Link>
                      )}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default LeaveLetters;

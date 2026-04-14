import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  MenuItem,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const requestTypes = [
  { value: 'book_request', label: 'Book Request', role: 'Librarian' },
  { value: 'hostel_room_change', label: 'Hostel Room Change', role: 'Hostel Warden' },
  { value: 'leave_request', label: 'Leave Request', role: 'Admin' },
  { value: 'other', label: 'Other', role: 'Admin' },
];

const statusColors = {
  pending: 'warning',
  in_progress: 'info',
  approved: 'success',
  rejected: 'error',
  completed: 'success',
};

const RequestsHub = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    request_type: 'book_request',
    title: '',
    description: '',
    book_title: '',
    book_author: '',
    desired_room: '',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['service-requests-student'],
    queryFn: async () => {
      const res = await axios.get('/service-requests/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const createRequest = useMutation({
    mutationFn: async (payload) => (await axios.post('/service-requests/', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['service-requests-student']);
      setSubmitSuccess('Request submitted successfully.');
      setSubmitError('');
      setForm((prev) => ({
        request_type: prev.request_type,
        title: '',
        description: '',
        book_title: '',
        book_author: '',
        desired_room: '',
        start_date: '',
        end_date: '',
        reason: '',
      }));
    },
    onError: (err) => {
      setSubmitError(err.response?.data?.detail || 'Failed to submit request.');
      setSubmitSuccess('');
    },
  });

  const cancelRequest = useMutation({
    mutationFn: async (id) => axios.delete(`/service-requests/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(['service-requests-student']),
  });

  const currentType = requestTypes.find((t) => t.value === form.request_type);

  const buildPayload = () => {
    const payload = {};
    if (form.request_type === 'book_request') {
      payload.book_title = form.book_title;
      payload.book_author = form.book_author;
      payload.reason = form.reason;
    } else if (form.request_type === 'hostel_room_change') {
      payload.desired_room = form.desired_room;
      payload.reason = form.reason;
    } else if (form.request_type === 'leave_request') {
      payload.start_date = form.start_date;
      payload.end_date = form.end_date;
      payload.reason = form.reason;
    } else {
      payload.reason = form.reason;
    }
    return payload;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    if (!form.title.trim()) {
      setSubmitError('Title is required.');
      return;
    }
    createRequest.mutate({
      request_type: form.request_type,
      title: form.title.trim(),
      description: form.description.trim(),
      payload: buildPayload(),
    });
  };

  const requests = useMemo(() => data || [], [data]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Requests Hub</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Submit a Request</Typography>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              select
              label="Request Type"
              value={form.request_type}
              onChange={(e) => setForm({ ...form, request_type: e.target.value })}
            >
              {requestTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              label="Description"
              multiline
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            {form.request_type === 'book_request' && (
              <>
                <TextField
                  label="Book Title"
                  value={form.book_title}
                  onChange={(e) => setForm({ ...form, book_title: e.target.value })}
                />
                <TextField
                  label="Author (optional)"
                  value={form.book_author}
                  onChange={(e) => setForm({ ...form, book_author: e.target.value })}
                />
              </>
            )}

            {form.request_type === 'hostel_room_change' && (
              <TextField
                label="Preferred Room"
                value={form.desired_room}
                onChange={(e) => setForm({ ...form, desired_room: e.target.value })}
              />
            )}

            {form.request_type === 'leave_request' && (
              <>
                <TextField
                  label="Start Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                <TextField
                  label="End Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </>
            )}

            <TextField
              label="Reason / Notes"
              multiline
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />

            <Typography variant="caption" color="text.secondary">
              Assigned to: {currentType?.role || 'Admin'}
            </Typography>

            <Button variant="contained" type="submit" disabled={createRequest.isLoading}>
              {createRequest.isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>My Requests</Typography>
        {isLoading && <CircularProgress size={24} />}
        {isError && <Alert severity="error">Failed to load requests.</Alert>}
        {!isLoading && !isError && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned</TableCell>
                <TableCell>Response</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.request_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{req.title}</TableCell>
                  <TableCell>
                    <Chip label={req.status} color={statusColors[req.status] || 'default'} size="small" />
                  </TableCell>
                  <TableCell>{req.assigned_role?.replace('_', ' ')}</TableCell>
                  <TableCell>{req.response_note || '-'}</TableCell>
                  <TableCell>
                    {req.status === 'pending' ? (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => cancelRequest.mutate(req.id)}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No requests yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
};

export default RequestsHub;

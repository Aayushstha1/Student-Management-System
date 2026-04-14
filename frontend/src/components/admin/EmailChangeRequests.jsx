import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const statusColor = (status) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'error';
  return 'warning';
};

const EmailChangeRequests = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['email-change-requests'],
    queryFn: async () => (await axios.get('/students/email-change-requests/')).data,
  });

  const requests = Array.isArray(data) ? data : (data?.results || []);

  const handleApprove = async (req) => {
    if (!req) return;
    if (!window.confirm('Approve this email change request?')) return;
    try {
      await axios.post(`/students/email-change-requests/${req.id}/approve/`);
      refetch();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve request.');
    }
  };

  const handleReject = async (req) => {
    if (!req) return;
    const note = window.prompt('Reason (optional) for rejection:') || '';
    try {
      await axios.post(`/students/email-change-requests/${req.id}/reject/`, { note });
      refetch();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject request.');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load email change requests.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Email Change Requests</Typography>
      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Requested At</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Current Email</TableCell>
                <TableCell>New Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.requested_at ? new Date(req.requested_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{req.student_name || 'Student'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {req.student_id} • {req.class_name || '-'} {req.section || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{req.current_email || '-'}</TableCell>
                  <TableCell>{req.new_email}</TableCell>
                  <TableCell>
                    <Chip label={req.status} color={statusColor(req.status)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleApprove(req)}
                        disabled={req.status !== 'pending'}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleReject(req)}
                        disabled={req.status !== 'pending'}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No requests found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default EmailChangeRequests;

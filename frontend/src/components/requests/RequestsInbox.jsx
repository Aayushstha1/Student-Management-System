import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  MenuItem,
  TextField,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const statusColors = {
  pending: 'warning',
  in_progress: 'info',
  approved: 'success',
  rejected: 'error',
  completed: 'success',
};

const RequestsInbox = ({ title = 'Requests Inbox', dense = false }) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['service-requests-inbox'],
    queryFn: async () => {
      const res = await axios.get('/service-requests/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status, response_note }) => (
      await axios.post(`/service-requests/${id}/respond/`, { status, response_note })
    ).data,
    onSuccess: () => queryClient.invalidateQueries(['service-requests-inbox']),
  });

  const requests = useMemo(() => {
    const list = data || [];
    return list.filter((req) => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      return true;
    });
  }, [data, statusFilter]);

  const handleRespond = (req, status) => {
    const note = window.prompt('Add a response note (optional):') || '';
    respondMutation.mutate({ id: req.id, status, response_note: note });
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">{title}</Typography>
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          {['all', 'pending', 'in_progress', 'approved', 'rejected', 'completed'].map((opt) => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </TextField>
      </Box>
      {isLoading && <CircularProgress size={24} />}
      {isError && <Alert severity="error">Failed to load requests.</Alert>}
      {!isLoading && !isError && (
        <Table size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell>{req.student_name || req.student_id}</TableCell>
                <TableCell>{req.request_type?.replace(/_/g, ' ')}</TableCell>
                <TableCell>{req.title}</TableCell>
                <TableCell>
                  <Chip label={req.status} color={statusColors[req.status] || 'default'} size="small" />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => handleRespond(req, 'in_progress')}>In Progress</Button>
                    <Button size="small" color="success" onClick={() => handleRespond(req, 'approved')}>Approve</Button>
                    <Button size="small" color="error" onClick={() => handleRespond(req, 'rejected')}>Reject</Button>
                    <Button size="small" onClick={() => handleRespond(req, 'completed')}>Complete</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">No requests.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
};

export default RequestsInbox;

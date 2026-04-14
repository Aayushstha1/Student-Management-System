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

const statusOptions = ['all', 'pending', 'in_progress', 'approved', 'rejected', 'completed'];

const RequestsHub = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['service-requests-admin'],
    queryFn: async () => {
      const res = await axios.get('/service-requests/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status, response_note }) => (
      await axios.post(`/service-requests/${id}/respond/`, { status, response_note })
    ).data,
    onSuccess: () => queryClient.invalidateQueries(['service-requests-admin']),
  });

  const requests = useMemo(() => {
    const list = data || [];
    return list.filter((req) => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (typeFilter !== 'all' && req.request_type !== typeFilter) return false;
      return true;
    });
  }, [data, statusFilter, typeFilter]);

  const requestTypes = useMemo(() => {
    const set = new Set((data || []).map((r) => r.request_type));
    return Array.from(set);
  }, [data]);

  const handleRespond = (req, status) => {
    const note = window.prompt('Add a response note (optional):') || '';
    respondMutation.mutate({ id: req.id, status, response_note: note });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Requests Hub</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {statusOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="all">all</MenuItem>
            {requestTypes.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {isLoading && <CircularProgress size={24} />}
        {isError && <Alert severity="error">Failed to load requests.</Alert>}
        {!isLoading && !isError && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned</TableCell>
                <TableCell>Response</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    {req.student_name || req.student_id} ({req.student_class} {req.student_section})
                  </TableCell>
                  <TableCell>{req.request_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{req.title}</TableCell>
                  <TableCell>
                    <Chip label={req.status} color={statusColors[req.status] || 'default'} size="small" />
                  </TableCell>
                  <TableCell>{req.assigned_role?.replace('_', ' ')}</TableCell>
                  <TableCell>{req.response_note || '-'}</TableCell>
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
                  <TableCell colSpan={7} align="center">
                    No requests found.
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

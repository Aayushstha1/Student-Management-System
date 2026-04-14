import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Alert,
  Stack,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const statusColor = (status) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'error';
  return 'warning';
};

const TripEventsBoard = ({ allowResponse = false }) => {
  const { isParent } = useAuth();
  const queryClient = useQueryClient();
  const canRespond = allowResponse && isParent;

  const { data, isError, isLoading } = useQuery({
    queryKey: ['trip-events'],
    queryFn: async () => (await axios.get('/students/consents/trip-events/')).data,
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => (await axios.post(`/students/consents/${id}/approve/`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-events'] });
      if (isParent) {
        queryClient.invalidateQueries({ queryKey: ['parent-consents'] });
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => (await axios.post(`/students/consents/${id}/reject/`, { reason })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-events'] });
      if (isParent) {
        queryClient.invalidateQueries({ queryKey: ['parent-consents'] });
      }
    },
  });

  const handleReject = (id) => {
    const reason = window.prompt('Reason for rejection (optional):') || '';
    rejectMutation.mutate({ id, reason });
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography>Loading trip events…</Typography>
      </Paper>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load trip events.</Alert>;
  }

  const events = Array.isArray(data) ? data : [];
  const formatTime = (value) => (value ? String(value).slice(0, 5) : '');

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Field Trip Events</Typography>
      {events.length === 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography>No trip events yet.</Typography>
        </Paper>
      )}
      {events.map((event) => (
        <Paper key={event.event_id} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{event.title}</Typography>
            <Chip label={`${event.start_date || ''} ${event.start_time ? `• ${formatTime(event.start_time)}` : ''}`} size="small" />
            {event.end_time && <Chip label={`End ${formatTime(event.end_time)}`} size="small" />}
            {event.location && <Chip label={`Location: ${event.location}`} size="small" />}
          </Box>
          {event.details && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {event.details}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label={`Total ${event.stats?.total || 0}`} size="small" />
            <Chip label={`Approved ${event.stats?.approved || 0}`} size="small" color="success" />
            <Chip label={`Rejected ${event.stats?.rejected || 0}`} size="small" color="error" />
            <Chip label={`Pending ${event.stats?.pending || 0}`} size="small" color="warning" />
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
                {canRespond && <TableCell>Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {event.responses.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.student_name} ({r.student_id})</TableCell>
                  <TableCell>{r.class_name} {r.section || ''}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} color={statusColor(r.status)} />
                  </TableCell>
                  <TableCell>{r.rejection_reason || '-'}</TableCell>
                  {canRespond && (
                    <TableCell>
                      {r.is_self && r.status === 'pending' ? (
                        <>
                          <Button size="small" variant="contained" sx={{ mr: 1 }} onClick={() => approveMutation.mutate(r.id)}>
                            Approve
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => handleReject(r.id)}>
                            Reject
                          </Button>
                        </>
                      ) : '-'}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {event.responses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canRespond ? 5 : 4} align="center">No responses yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      ))}
    </Box>
  );
};

export default TripEventsBoard;

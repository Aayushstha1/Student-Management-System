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
  Button,
  Chip,
  Alert,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import TripEventsBoard from '../consents/TripEventsBoard';

const ParentConsents = () => {
  const queryClient = useQueryClient();

  const { data: consentsData, isError } = useQuery({
    queryKey: ['parent-consents'],
    queryFn: async () => {
      const res = await axios.get('/students/consents/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => (await axios.post(`/students/consents/${id}/approve/`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parent-consents'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => (await axios.post(`/students/consents/${id}/reject/`, { reason })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parent-consents'] }),
  });

  const consents = consentsData || [];

  const handleReject = (id) => {
    const reason = window.prompt('Reason for rejection (optional):') || '';
    rejectMutation.mutate({ id, reason });
  };

  const typeLabel = (value) => {
    switch (value) {
      case 'trip':
        return 'Field Trip';
      case 'hostel_leave':
        return 'Hostel Leave';
      case 'medical':
        return 'Medical';
      case 'other':
        return 'Other';
      default:
        return value;
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Consent Approvals</Typography>
      <TripEventsBoard allowResponse />
      <Paper sx={{ p: 2 }}>
        {isError && <Alert severity="error">Failed to load requests.</Alert>}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {consents.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{typeLabel(c.request_type)}</TableCell>
                <TableCell>{c.title}</TableCell>
                <TableCell>{c.start_date || '-'} to {c.end_date || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.status} color={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'error' : 'warning'} />
                </TableCell>
                <TableCell>
                  {c.status === 'pending' ? (
                    <>
                      <Button size="small" variant="contained" sx={{ mr: 1 }} onClick={() => approveMutation.mutate(c.id)}>
                        Approve
                      </Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => handleReject(c.id)}>
                        Reject
                      </Button>
                    </>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
            {consents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">No requests.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default ParentConsents;

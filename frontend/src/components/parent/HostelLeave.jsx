import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const getStatusColor = (status) => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending_parent':
      return 'warning';
    case 'pending_warden':
    default:
      return 'info';
  }
};

const HostelLeave = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-hostel-leave-requests'],
    queryFn: async () => (await axios.get('/hostel/leave-requests/')).data,
  });

  const leaveRequests = Array.isArray(data) ? data : (data?.results || []);

  const approveLeave = useMutation({
    mutationFn: async ({ id, note }) => axios.patch(`/hostel/leave-requests/${id}/parent-approve/`, { note }),
    onSuccess: () => queryClient.invalidateQueries(['parent-hostel-leave-requests']),
  });

  const rejectLeave = useMutation({
    mutationFn: async ({ id, note }) => axios.patch(`/hostel/leave-requests/${id}/parent-reject/`, { note }),
    onSuccess: () => queryClient.invalidateQueries(['parent-hostel-leave-requests']),
  });

  const handleApprove = (req) => {
    const input = window.prompt('Add a note (optional):');
    if (input === null) return;
    approveLeave.mutate({ id: req.id, note: input || '' });
  };

  const handleReject = (req) => {
    const input = window.prompt('Add a rejection note (optional):');
    if (input === null) return;
    rejectLeave.mutate({ id: req.id, note: input || '' });
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Hostel Leave Approval
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Approve or reject hostel leave requests after the warden approves them.
        </Typography>
      </Paper>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Failed to load leave requests.</Alert>}

      {!isLoading && !error && (
        <Paper sx={{ p: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Dates</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Warden Note</TableCell>
                  <TableCell>Parent Note</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaveRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.start_date} - {req.end_date}</TableCell>
                    <TableCell>{req.reason || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={String(req.status || '').replace('_', ' ')}
                        color={getStatusColor(req.status)}
                      />
                    </TableCell>
                    <TableCell>{req.warden_note || '-'}</TableCell>
                    <TableCell>{req.parent_note || '-'}</TableCell>
                    <TableCell>
                      {req.status === 'pending_parent' ? (
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="contained" onClick={() => handleApprove(req)}>
                            Approve
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => handleReject(req)}>
                            Reject
                          </Button>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {leaveRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No leave requests found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default HostelLeave;

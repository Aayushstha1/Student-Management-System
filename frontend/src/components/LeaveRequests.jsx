import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
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

const LeaveRequests = ({ title = 'Leave Requests' }) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('pending');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leave-requests', tab, selectedYear, selectedMonth],
    queryFn: async () => {
      const params = {};
      if (tab !== 'all') params.status = tab;
      if (selectedYear) params.year = selectedYear;
      if (selectedMonth !== 'all') params.month = selectedMonth;
      const response = await axios.get('attendance/leaves/', { params });
      return response.data;
    },
  });

  const leaves = Array.isArray(data) ? data : data?.results || [];

  const approvalMutation = useMutation({
    mutationFn: async ({ id, status, reason }) => {
      const response = await axios.patch(`attendance/leaves/${id}/approve/`, {
        status,
        rejection_reason: reason || '',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });

  const handleApprove = (leave) => {
    approvalMutation.mutate({ id: leave.id, status: 'approved' });
  };

  const openReject = (leave) => {
    setRejectTarget(leave);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const submitReject = () => {
    if (!rejectTarget) return;
    approvalMutation.mutate({
      id: rejectTarget.id,
      status: 'rejected',
      reason: rejectReason,
    });
    setRejectDialogOpen(false);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {title}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Tabs value={tab} onChange={(e, value) => setTab(value)}>
              <Tab value="all" label="All" />
              <Tab value="pending" label="Pending" />
              <Tab value="approved" label="Approved" />
              <Tab value="rejected" label="Rejected" />
            </Tabs>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Year</InputLabel>
              <Select
                label="Year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Month</InputLabel>
              <Select
                label="Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, idx) => (
                  <MenuItem key={label} value={idx + 1}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={30} />
          </Box>
        ) : isError ? (
          <Alert severity="error">Failed to load leave requests.</Alert>
        ) : leaves.length === 0 ? (
          <Typography color="text.secondary">No leave requests.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Attachment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>
                    {leave.student_name || leave.student_id}
                  </TableCell>
                  <TableCell>
                    {leave.student_class} {leave.student_section || ''}
                  </TableCell>
                  <TableCell>
                    {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{leave.reason}</TableCell>
                  <TableCell>
                    <Chip size="small" label={leave.status} color={statusColor(leave.status)} />
                  </TableCell>
                  <TableCell>
                    {leave.attachment_url ? (
                      <Link href={leave.attachment_url} target="_blank" rel="noreferrer">
                        View
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {leave.status === 'pending' ? (
                      <>
                        <Button size="small" color="success" onClick={() => handleApprove(leave)}>
                          Approve
                        </Button>
                        <Button size="small" color="error" onClick={() => openReject(leave)}>
                          Reject
                        </Button>
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reject Leave Request</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={submitReject} disabled={approvalMutation.isPending}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveRequests;

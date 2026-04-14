import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
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

const PasswordResetRequests = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['password-reset-requests'],
    queryFn: async () => (await axios.get('/students/password-reset-requests/')).data,
  });

  const [approveOpen, setApproveOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const requests = Array.isArray(data) ? data : (data?.results || []);

  const openApprove = (req) => {
    setSelected(req);
    setPassword('');
    setPasswordConfirm('');
    setActionError('');
    setActionSuccess('');
    setApproveOpen(true);
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!password || !passwordConfirm) {
      setActionError('Password and confirm password are required.');
      return;
    }
    if (password !== passwordConfirm) {
      setActionError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setActionError('');
    setActionSuccess('');
    try {
      const resp = await axios.post(`/students/password-reset-requests/${selected.id}/approve/`, {
        password,
        password_confirm: passwordConfirm,
      });
      setActionSuccess(resp.data?.detail || 'Password updated and emailed.');
      setApproveOpen(false);
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to approve request.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (req) => {
    if (!req) return;
    if (!window.confirm('Reject this password reset request?')) return;
    try {
      await axios.post(`/students/password-reset-requests/${req.id}/reject/`);
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
    return <Alert severity="error">Failed to load password reset requests.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Password Reset Requests</Typography>
      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Requested At</TableCell>
                <TableCell>Student Info</TableCell>
                <TableCell>Provided Details</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.requested_at ? new Date(req.requested_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    {req.is_matched ? (
                      <Box>
                        <Typography variant="body2">{req.student_name || 'Student'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {req.student_id} • {req.student_class || '-'} {req.student_section || ''}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="error">No match found</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">Username: {req.username}</Typography>
                    <Typography variant="body2">Class: {req.class_name}</Typography>
                    <Typography variant="body2">Father: {req.father_name}</Typography>
                    <Typography variant="body2">Email: {req.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={req.status} color={statusColor(req.status)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => openApprove(req)}
                        disabled={req.status !== 'pending' || !req.is_matched}
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
                  <TableCell colSpan={5} align="center">No requests found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Approve Request</DialogTitle>
        <DialogContent>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          {actionSuccess && <Alert severity="success" sx={{ mb: 2 }}>{actionSuccess}</Alert>}
          <TextField
            fullWidth
            margin="normal"
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Confirm Password"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The new password will be emailed to the student.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApprove} disabled={saving}>
            {saving ? <CircularProgress size={22} /> : 'Approve & Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PasswordResetRequests;

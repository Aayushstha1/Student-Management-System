import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  MenuItem,
  Button,
  Chip,
  Alert,
  Grid,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import TripEventsBoard from '../consents/TripEventsBoard';

const AdminConsentManagement = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [tripForm, setTripForm] = useState({
    title: '',
    details: '',
    location: '',
    start_date: '',
    start_time: '',
    end_time: '',
    send_to_all: true,
    class_name: '',
    section: '',
  });
  const [tripError, setTripError] = useState('');

  const { data: consentsData, isError } = useQuery({
    queryKey: ['admin-consents'],
    queryFn: async () => {
      const res = await axios.get('/students/consents/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => (await axios.post(`/students/consents/${id}/approve/`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-consents'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => (await axios.post(`/students/consents/${id}/reject/`, { reason })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-consents'] }),
  });

  const consents = (consentsData || []).filter((c) => (statusFilter ? c.status === statusFilter : true));

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

  const handleTripChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTripForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleTripSubmit = async (e) => {
    e.preventDefault();
    setTripError('');
    if (!tripForm.title.trim() || !tripForm.start_date) {
      setTripError('Title and date are required.');
      return;
    }
    try {
      await axios.post('/students/consents/trip-events/', tripForm);
      setTripForm({
        title: '',
        details: '',
        location: '',
        start_date: '',
        start_time: '',
        end_time: '',
        amount: '',
        send_to_all: true,
        class_name: '',
        section: '',
      });
      queryClient.invalidateQueries({ queryKey: ['trip-events'] });
    } catch (err) {
      setTripError(err.response?.data?.detail || 'Failed to create trip event.');
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Consent Forms</Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Create Field Trip Event</Typography>
        {tripError && <Alert severity="error" sx={{ mb: 2 }}>{tripError}</Alert>}
        <Box component="form" onSubmit={handleTripSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Title" name="title" value={tripForm.title} onChange={handleTripChange} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Location" name="location" value={tripForm.location} onChange={handleTripChange} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth type="date" label="Date" name="start_date" value={tripForm.start_date} InputLabelProps={{ shrink: true }} onChange={handleTripChange} />
            </Grid>
            <Grid item xs={12} md={1}>
              <TextField fullWidth type="time" label="Start" name="start_time" value={tripForm.start_time} InputLabelProps={{ shrink: true }} onChange={handleTripChange} />
            </Grid>
            <Grid item xs={12} md={1}>
              <TextField fullWidth type="time" label="End" name="end_time" value={tripForm.end_time} InputLabelProps={{ shrink: true }} onChange={handleTripChange} />
            </Grid>
            <Grid item xs={12} md={10}>
              <TextField fullWidth label="Details" name="details" value={tripForm.details} onChange={handleTripChange} multiline minRows={2} />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControlLabel
                control={<Switch checked={tripForm.send_to_all} onChange={handleTripChange} name="send_to_all" />}
                label="Send to all"
              />
            </Grid>
            {!tripForm.send_to_all && (
              <>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Class" name="class_name" value={tripForm.class_name} onChange={handleTripChange} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Section" name="section" value={tripForm.section} onChange={handleTripChange} />
                </Grid>
              </>
            )}
            <Grid item xs={12} md={2}>
              <Button type="submit" variant="contained" fullWidth>
                Send Consent
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <TripEventsBoard />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {isError && <Alert severity="error">Failed to load requests.</Alert>}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
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
                <TableCell>{c.student_name} ({c.student_id})</TableCell>
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
                <TableCell colSpan={6} align="center">No requests.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default AdminConsentManagement;

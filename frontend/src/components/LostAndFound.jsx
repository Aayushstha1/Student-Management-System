import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Chip,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const LostAndFound = ({ title = 'Lost & Found' }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    item_type: 'lost',
    title: '',
    description: '',
    location: '',
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lostfound-items'],
    queryFn: async () => (await axios.get('/lostfound/items/')).data,
  });

  const items = useMemo(() => {
    const list = Array.isArray(data) ? data : (data?.results || []);
    return list.filter((item) => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterType !== 'all' && item.item_type !== filterType) return false;
      return true;
    });
  }, [data, filterStatus, filterType]);

  const createItem = useMutation({
    mutationFn: async (payload) => (await axios.post('/lostfound/items/', payload)).data,
    onSuccess: () => {
      setForm({ item_type: 'lost', title: '', description: '', location: '' });
      setError('');
      queryClient.invalidateQueries({ queryKey: ['lostfound-items'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to submit item.'),
  });

  const markFound = useMutation({
    mutationFn: async ({ id, note }) => (await axios.post(`/lostfound/items/${id}/mark-found/`, { note })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lostfound-items'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Item name is required.');
      return;
    }
    createItem.mutate({
      item_type: form.item_type,
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
    });
  };

  const handleMarkFound = (item) => {
    const note = window.prompt('Add note (optional):', '');
    markFound.mutate({ id: item.id, note: note || '' });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>{title}</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Report Missing/Found Item</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Type"
                value={form.item_type}
                onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value }))}
              >
                <MenuItem value="lost">Lost</MenuItem>
                <MenuItem value="found">Found</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Item"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Math notebook"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Location (optional)"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <Button fullWidth variant="contained" type="submit" disabled={createItem.isPending}>
                Submit
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={2}>
            <TextField
              select
              fullWidth
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="found">Found</MenuItem>
              <MenuItem value="returned">Returned</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              select
              fullWidth
              label="Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
              <MenuItem value="found">Found</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        {isLoading && <Typography color="text.secondary">Loading...</Typography>}
        {isError && <Alert severity="error">Failed to load items.</Alert>}

        {!isLoading && !isError && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Item</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Reported By</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Found By</TableCell>
                <TableCell>Note</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.item_type}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.location || '-'}</TableCell>
                  <TableCell>{item.reported_by_name || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={item.status} color={item.status === 'open' ? 'warning' : 'success'} />
                  </TableCell>
                  <TableCell>{item.found_by_name || '-'}</TableCell>
                  <TableCell>{item.found_note || '-'}</TableCell>
                  <TableCell>
                    {item.status === 'open' ? (
                      <Button size="small" onClick={() => handleMarkFound(item)} disabled={markFound.isPending}>
                        Mark Found
                      </Button>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">No items found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
};

export default LostAndFound;

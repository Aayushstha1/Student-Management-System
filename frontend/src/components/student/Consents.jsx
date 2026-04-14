import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import TripEventsBoard from '../consents/TripEventsBoard';

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

const StudentConsents = () => {
  const { data: consentsData, isError } = useQuery({
    queryKey: ['student-consents'],
    queryFn: async () => {
      const res = await axios.get('/students/consents/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const consents = consentsData || [];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Consent Requests</Typography>
      <TripEventsBoard />

      {isError && <Alert severity="error">Failed to load requests.</Alert>}

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Your Status</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Status</TableCell>
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
              </TableRow>
            ))}
            {consents.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">No requests yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default StudentConsents;

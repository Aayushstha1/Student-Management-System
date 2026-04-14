import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const statusColor = (status) => {
  if (status === 'issued') return 'warning';
  if (status === 'overdue') return 'error';
  if (status === 'returned') return 'success';
  return 'default';
};

const accent = '#0f766e';
const accentDark = '#0b5d57';
const cardShadow = '0 8px 18px rgba(15, 118, 110, 0.08)';

const BorrowHistory = () => {
  const [filter, setFilter] = useState('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['library-issues-student'],
    queryFn: async () => {
      const res = await axios.get('/library/issues/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const filtered = useMemo(() => {
    const list = data || [];
    if (filter === 'all') return list;
    return list.filter((i) => (i.status || '').toLowerCase() === filter);
  }, [data, filter]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load borrowing history.</Alert>;
  }

  return (
    <Box>
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
          color: 'white',
          borderRadius: 3,
          boxShadow: cardShadow,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Borrowing History</Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>Track issued, returned, and overdue books</Typography>
      </Paper>

      <Paper sx={{ mb: 2, borderRadius: 2.5, boxShadow: cardShadow }}>
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="All" value="all" />
          <Tab label="Issued" value="issued" />
          <Tab label="Returned" value="returned" />
          <Tab label="Overdue" value="overdue" />
        </Tabs>
      </Paper>

      <Paper sx={{ borderRadius: 2.5, boxShadow: cardShadow }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Book</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell>{issue.book_title || issue.book?.title || 'Book'}</TableCell>
                  <TableCell>{issue.issued_date || '-'}</TableCell>
                  <TableCell>{issue.due_date || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={(issue.status || 'issued').toUpperCase()}
                      color={statusColor((issue.status || '').toLowerCase())}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">No records found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default BorrowHistory;

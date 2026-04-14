import React, { useMemo } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const ParentResults = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['parent-results'],
    queryFn: async () => (await axios.get('/parents/results/')).data,
  });

  const results = useMemo(() => Array.isArray(data) ? data : (data?.results || []), [data]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load results.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Results
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Exam</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell align="right">Marks</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="center">Grade</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.exam_name || row.exam}</TableCell>
                <TableCell>{row.subject_name || '—'}</TableCell>
                <TableCell align="right">{row.marks_obtained}</TableCell>
                <TableCell align="right">{row.total_marks}</TableCell>
                <TableCell align="center">{row.grade || '—'}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No results available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ParentResults;

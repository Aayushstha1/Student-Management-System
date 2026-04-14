import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const ReportCard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-results'],
    queryFn: async () => {
      const res = await axios.get('results/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const rows = data || [];

  const gradeColor = (g) => {
    switch (g) {
      case 'A+':
      case 'A':
        return 'success';
      case 'B+':
      case 'B':
        return 'primary';
      default:
        return 'warning';
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Report Card
      </Typography>
      <Paper sx={{ p: 2 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Alert severity="error">Failed to load results.</Alert>
        ) : rows.length === 0 ? (
          <Alert severity="info">No approved results available yet.</Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Subject Code</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Exam</TableCell>
                <TableCell align="right">Marks</TableCell>
                <TableCell align="center">Grade</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.subject_code || '-'}</TableCell>
                  <TableCell>{r.subject_name || '-'}</TableCell>
                  <TableCell>{r.exam_name || '-'}</TableCell>
                  <TableCell align="right">
                    {r.marks_obtained ?? '-'} / {r.total_marks || '100'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={r.grade || '-'} color={gradeColor(r.grade)} size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
};

export default ReportCard;



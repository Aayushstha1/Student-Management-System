import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const examTypeLabels = {
  unit_test: 'Unit Test',
  mid_term: 'Mid Term',
  final: 'Final Exam',
  pre_board: 'Pre-Board',
  practical: 'Practical',
  assignment: 'Assignment',
  project: 'Project',
};

const ExamRoutine = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-exam-routine'],
    queryFn: async () => {
      const res = await axios.get('/results/exams/');
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const exams = useMemo(() => (data || []).filter((e) => e.is_active !== false), [data]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }
  if (isError) {
    return <Alert severity="error">Failed to load exam routine.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Exam Routine</Typography>
      <Paper sx={{ p: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Subject</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Pass</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exams.map((exam) => (
              <TableRow key={exam.id}>
                <TableCell>{exam.subject_name || exam.subject}</TableCell>
                <TableCell>{examTypeLabels[exam.exam_type] || exam.exam_type}</TableCell>
                <TableCell>{exam.exam_date}</TableCell>
                <TableCell>
                  {exam.start_time || exam.end_time
                    ? `${exam.start_time || '--:--'} - ${exam.end_time || '--:--'}`
                    : '-'}
                </TableCell>
                <TableCell align="right">{exam.total_marks}</TableCell>
                <TableCell align="right">{exam.passing_marks}</TableCell>
              </TableRow>
            ))}
            {exams.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">No exams scheduled.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default ExamRoutine;

import React, { useMemo, useState } from 'react';
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
  Grid,
  TextField,
  MenuItem,
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
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  const { data: classSubjectsData } = useQuery({
    queryKey: ['teacher-class-subjects'],
    queryFn: async () => {
      const resp = await axios.get('results/class-subjects/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const { data: examsData, isLoading, isError } = useQuery({
    queryKey: ['teacher-exam-routine', classFilter, sectionFilter],
    queryFn: async () => {
      const res = await axios.get('/results/exams/', {
        params: {
          class_name: classFilter || undefined,
          section: sectionFilter || undefined,
        },
      });
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
  });

  const classSubjects = useMemo(() => classSubjectsData || [], [classSubjectsData]);
  const classOptions = useMemo(() => {
    const unique = new Set(classSubjects.map((c) => c.class_name).filter(Boolean));
    return Array.from(unique);
  }, [classSubjects]);

  const sectionOptions = useMemo(() => {
    if (!classFilter) return [];
    const unique = new Set(
      classSubjects
        .filter((c) => c.class_name === classFilter)
        .map((c) => c.section || '')
    );
    return Array.from(unique);
  }, [classSubjects, classFilter]);

  const exams = useMemo(() => {
    return (examsData || []).filter((e) => e.is_active !== false);
  }, [examsData]);

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
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              select={classOptions.length > 0}
              fullWidth
              label="Class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              {classOptions.length === 0 ? null : classOptions.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              select={sectionOptions.length > 0}
              fullWidth
              label="Section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              {sectionOptions.length === 0 ? null : sectionOptions.map((s) => (
                <MenuItem key={s || '__none__'} value={s}>{s || '-'}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
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
                <TableCell>{exam.class_name || '-'}</TableCell>
                <TableCell>{exam.section || '-'}</TableCell>
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
                <TableCell colSpan={8} align="center">No exams scheduled.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default ExamRoutine;

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
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

const ClassAnalytics = () => {
  const [analyticsClass, setAnalyticsClass] = useState('');
  const [analyticsSection, setAnalyticsSection] = useState('');
  const [analyticsSubject, setAnalyticsSubject] = useState('');

  const { data: classSubjects } = useQuery({
    queryKey: ['class-subjects-teacher-analytics'],
    queryFn: async () => {
      const resp = await axios.get('results/class-subjects/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const classOptions = useMemo(() => {
    const unique = new Set((classSubjects || []).map((c) => c.class_name));
    return Array.from(unique).sort();
  }, [classSubjects]);

  const sectionOptions = useMemo(() => {
    if (!analyticsClass) return [];
    const unique = new Set(
      (classSubjects || [])
        .filter((c) => c.class_name === analyticsClass)
        .map((c) => c.section || '')
    );
    return Array.from(unique).sort();
  }, [classSubjects, analyticsClass]);

  const subjectOptions = useMemo(() => {
    if (!analyticsClass) return [];
    const filtered = (classSubjects || []).filter((c) => c.class_name === analyticsClass);
    const unique = new Map();
    filtered.forEach((c) => {
      if (!unique.has(c.subject)) {
        unique.set(c.subject, { id: c.subject, name: c.subject_name || c.subject_code || `Subject ${c.subject}` });
      }
    });
    return Array.from(unique.values());
  }, [classSubjects, analyticsClass]);

  const { data: topicAnalytics, isLoading } = useQuery({
    queryKey: ['topic-analytics-teacher', analyticsClass, analyticsSection, analyticsSubject],
    queryFn: async () => {
      const params = {};
      if (analyticsClass) params.class = analyticsClass;
      if (analyticsSection) params.section = analyticsSection;
      if (analyticsSubject) params.subject = analyticsSubject;
      const resp = await axios.get('results/topic-analytics/', { params });
      return Array.isArray(resp.data) ? resp.data : [];
    },
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Class Performance Analytics</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Class"
              value={analyticsClass}
              onChange={(e) => {
                setAnalyticsClass(e.target.value);
                setAnalyticsSection('');
                setAnalyticsSubject('');
              }}
            >
              {classOptions.map((cls) => (
                <MenuItem key={cls} value={cls}>Class {cls}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Section"
              value={analyticsSection}
              onChange={(e) => setAnalyticsSection(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {sectionOptions.map((sec) => (
                <MenuItem key={sec} value={sec}>{sec || '—'}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Subject"
              value={analyticsSubject}
              onChange={(e) => setAnalyticsSubject(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {subjectOptions.map((subj) => (
                <MenuItem key={subj.id} value={subj.id}>{subj.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={28} />
          </Box>
        ) : (topicAnalytics && topicAnalytics.length > 0) ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Topic</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell align="right">Avg %</TableCell>
                <TableCell align="right">Avg Marks</TableCell>
                <TableCell align="right">Students</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topicAnalytics.map((row, idx) => (
                <TableRow key={`${row.subject_id}-${row.topic}-${idx}`}>
                  <TableCell>{row.topic}</TableCell>
                  <TableCell>{row.subject_name}</TableCell>
                  <TableCell align="right">{row.avg_percentage}</TableCell>
                  <TableCell align="right">{row.avg_marks}</TableCell>
                  <TableCell align="right">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Alert severity="info">No analytics data available for the selected filters.</Alert>
        )}
      </Paper>
    </Box>
  );
};

export default ClassAnalytics;

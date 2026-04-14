import React from 'react';
import { Box, Typography, Paper, LinearProgress, Grid, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const Attendance = () => {
  const { data: records, isLoading, isError } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      const res = await axios.get('/attendance/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      return list;
    },
  });

  // Daily summary: operating days, present days, absent days
  const byDate = {};
  (records || []).forEach((r) => {
    const dateKey = (r.date || r.attendance_date || '').split('T')[0] || 'unknown';
    if (!byDate[dateKey]) {
      byDate[dateKey] = { any: false, present: false };
    }
    byDate[dateKey].any = true;
    if (['present', 'late', 'excused'].includes((r.status || '').toLowerCase())) {
      byDate[dateKey].present = true;
    }
  });
  const validDays = Object.keys(byDate).filter((d) => d !== 'unknown');
  const operatingDays = validDays.length;
  const presentDays = validDays.filter((d) => byDate[d].present).length;
  const absentDays = operatingDays - presentDays;
  const overallPercent = operatingDays ? Math.round((presentDays / operatingDays) * 100) : 0;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }
  if (isError) {
    return <Alert severity="error">Failed to load attendance.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Attendance
      </Typography>

      {/* Overall summary */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Operating Days
            </Typography>
            <Typography variant="h6">{operatingDays || '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Present Days
            </Typography>
            <Typography variant="h6">{presentDays || '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Absent Days
            </Typography>
            <Typography variant="h6">{absentDays || '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Overall Attendance
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ flexGrow: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={overallPercent}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Typography variant="body2">{overallPercent}%</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

    </Box>
  );
};

export default Attendance;



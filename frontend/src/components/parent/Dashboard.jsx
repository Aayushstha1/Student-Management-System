import React, { useMemo } from 'react';
import { Box, Typography, Grid, Paper, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const StatCard = ({ label, value }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="subtitle2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6">{value}</Typography>
  </Paper>
);

const ParentHome = () => {
  const today = new Date();

  const { data: profile } = useQuery({
    queryKey: ['parent-profile'],
    queryFn: async () => (await axios.get('/parents/profile/')).data,
  });

  const { data: monthlyProgress } = useQuery({
    queryKey: ['parent-attendance-monthly'],
    queryFn: async () => (await axios.get('/parents/attendance/progress/monthly/')).data,
  });

  const { data: calendarItems } = useQuery({
    queryKey: ['parent-calendar'],
    queryFn: async () => (await axios.get('/parents/calendar/')).data,
  });

  const student = profile?.student;

  const upcomingItems = useMemo(() => {
    const items = Array.isArray(calendarItems) ? calendarItems : [];
    return items
      .filter((item) => item.event_date && new Date(item.event_date) >= today)
      .slice(0, 5);
  }, [calendarItems, today]);

  const attendancePercent = Math.round(monthlyProgress?.progress || 0);

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Parent Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {student?.name || 'Student'} • {student?.student_id || '—'} • Class {student?.class || '—'} {student?.section || ''}
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Attendance (Month)" value={`${attendancePercent}%`} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Upcoming Schedule</Typography>
            <Divider sx={{ mb: 1 }} />
            {upcomingItems.length ? (
              <List>
                {upcomingItems.map((item) => (
                  <ListItem key={item.id} divider>
                    <ListItemText
                      primary={item.title}
                      secondary={`${item.event_date}${item.description ? ` • ${item.description}` : ''}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">No upcoming items.</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Attendance Summary</Typography>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Total days: {monthlyProgress?.total_days ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Present: {monthlyProgress?.present_days ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Absent: {monthlyProgress?.absent_days ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Late: {monthlyProgress?.late_days ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Excused: {monthlyProgress?.excused_days ?? '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

    </Box>
  );
};

export default ParentHome;

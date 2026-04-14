import React, { useMemo } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Timetable = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: async () => (await axios.get('/timetable/schedules/')).data,
  });

  const schedules = useMemo(() => Array.isArray(data) ? data : (data?.results || []), [data]);

  const grouped = useMemo(() => {
    const map = new Map();
    schedules.forEach((item) => {
      const day = item.day_of_week ?? 0;
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(item);
    });
    for (const [day, list] of map.entries()) {
      list.sort((a, b) => (a.period || 0) - (b.period || 0));
    }
    return map;
  }, [schedules]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load timetable.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Timetable</Typography>
      {dayLabels.map((label, dayIndex) => {
        const list = grouped.get(dayIndex) || [];
        return (
          <Paper sx={{ p: 2, mb: 2 }} key={label}>
            <Typography variant="h6" sx={{ mb: 1 }}>{label}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Room</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.period}</TableCell>
                    <TableCell>{row.subject_name || '—'}</TableCell>
                    <TableCell>{row.teacher_name || '—'}</TableCell>
                    <TableCell>{row.start_time} - {row.end_time}</TableCell>
                    <TableCell>{row.room || '—'}</TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No periods scheduled.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        );
      })}
    </Box>
  );
};

export default Timetable;

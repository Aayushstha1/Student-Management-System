import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const dayOptions = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];


const TimetableManagement = () => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    class_name: '',
    section: '',
    day_of_week: 0,
    period: 1,
    subject: '',
    teacher: '',
    start_time: '',
    end_time: '',
    room: '',
    is_active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const { data: schedulesData } = useQuery({
    queryKey: ['class-schedules'],
    queryFn: async () => (await axios.get('/timetable/schedules/')).data,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => (await axios.get('/attendance/subjects/')).data,
  });

  const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => (await axios.get('/teachers/')).data,
  });

  const schedules = useMemo(() => normalizeList(schedulesData), [schedulesData]);
  const subjects = useMemo(() => normalizeList(subjectsData), [subjectsData]);
  const teachers = useMemo(() => normalizeList(teachersData), [teachersData]);

  const createSchedule = useMutation({
    mutationFn: async (payload) => (await axios.post('/timetable/schedules/', payload)).data,
    onSuccess: () => {
      setForm({
        class_name: '',
        section: '',
        day_of_week: 0,
        period: 1,
        subject: '',
        teacher: '',
        start_time: '',
        end_time: '',
        room: '',
        is_active: true,
      });
      setEditingId(null);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to save schedule.'),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, payload }) => (await axios.patch(`/timetable/schedules/${id}/`, payload)).data,
    onSuccess: () => {
      setForm({
        class_name: '',
        section: '',
        day_of_week: 0,
        period: 1,
        subject: '',
        teacher: '',
        start_time: '',
        end_time: '',
        room: '',
        is_active: true,
      });
      setEditingId(null);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to update schedule.'),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id) => axios.delete(`/timetable/schedules/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['class-schedules'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.class_name || !form.subject || !form.start_time || !form.end_time) {
      setError('Class, subject, and start/end time are required.');
      return;
    }
    const payload = {
      class_name: form.class_name,
      section: form.section || '',
      day_of_week: Number(form.day_of_week),
      period: Number(form.period || 1),
      subject: form.subject,
      teacher: form.teacher || null,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || '',
      is_active: form.is_active,
    };
    if (editingId) {
      updateSchedule.mutate({ id: editingId, payload });
    } else {
      createSchedule.mutate(payload);
    }
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setForm({
      class_name: row.class_name || '',
      section: row.section || '',
      day_of_week: row.day_of_week ?? 0,
      period: row.period || 1,
      subject: row.subject,
      teacher: row.teacher || '',
      start_time: row.start_time || '',
      end_time: row.end_time || '',
      room: row.room || '',
      is_active: row.is_active,
    });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Timetable Management</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Create Schedule</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="Class" value={form.class_name} onChange={(e) => setForm((p) => ({ ...p, class_name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={1}>
              <TextField fullWidth label="Section" value={form.section} onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField select fullWidth label="Day" value={form.day_of_week} onChange={(e) => setForm((p) => ({ ...p, day_of_week: e.target.value }))}>
                {dayOptions.map((d) => (
                  <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={1}>
              <TextField fullWidth type="number" label="Period" value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField select fullWidth label="Subject" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}>
                {subjects.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField select fullWidth label="Teacher" value={form.teacher} onChange={(e) => setForm((p) => ({ ...p, teacher: e.target.value }))}>
                <MenuItem value="">Unassigned</MenuItem>
                {teachers.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.user_details?.first_name || ''} {t.user_details?.last_name || ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth type="time" label="Start" InputLabelProps={{ shrink: true }} value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth type="time" label="End" InputLabelProps={{ shrink: true }} value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="Room" value={form.room} onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" type="submit" disabled={createSchedule.isPending || updateSchedule.isPending}>
                {editingId ? 'Update' : 'Add'}
              </Button>
              {editingId && (
                <Button fullWidth sx={{ mt: 1 }} onClick={() => {
                  setEditingId(null);
                  setForm({
                    class_name: '',
                    section: '',
                    day_of_week: 0,
                    period: 1,
                    subject: '',
                    teacher: '',
                    start_time: '',
                    end_time: '',
                    room: '',
                    is_active: true,
                  });
                }}>
                  Cancel
                </Button>
              )}
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Schedules</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Day</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Room</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.class_name}</TableCell>
                <TableCell>{row.section || '-'}</TableCell>
                <TableCell>{dayOptions.find((d) => d.value === Number(row.day_of_week))?.label || row.day_of_week}</TableCell>
                <TableCell>{row.period}</TableCell>
                <TableCell>{row.subject_name || '-'}</TableCell>
                <TableCell>{row.teacher_name || '-'}</TableCell>
                <TableCell>{row.start_time} - {row.end_time}</TableCell>
                <TableCell>{row.room || '-'}</TableCell>
                <TableCell>{row.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(row)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => {
                    if (window.confirm('Delete this schedule?')) {
                      deleteSchedule.mutate(row.id);
                    }
                  }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">No schedules yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

    </Box>
  );
};

export default TimetableManagement;

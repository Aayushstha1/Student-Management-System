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
  Divider,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LessonPlans = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    schedule: '',
    lesson_date: '',
    topic: '',
    objectives: '',
    materials: '',
    homework: '',
    status: 'planned',
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const { data: schedulesData } = useQuery({
    queryKey: ['teacher-schedules'],
    queryFn: async () => (await axios.get('/timetable/schedules/')).data,
  });

  const { data: plansData } = useQuery({
    queryKey: ['lesson-plans'],
    queryFn: async () => (await axios.get('/timetable/lesson-plans/')).data,
  });

  const schedules = useMemo(() => normalizeList(schedulesData), [schedulesData]);
  const plans = useMemo(() => normalizeList(plansData), [plansData]);

  const createPlan = useMutation({
    mutationFn: async (payload) => (await axios.post('/timetable/lesson-plans/', payload)).data,
    onSuccess: () => {
      setForm({ schedule: '', lesson_date: '', topic: '', objectives: '', materials: '', homework: '', status: 'planned' });
      setEditingId(null);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to save lesson plan.'),
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, payload }) => (await axios.patch(`/timetable/lesson-plans/${id}/`, payload)).data,
    onSuccess: () => {
      setForm({ schedule: '', lesson_date: '', topic: '', objectives: '', materials: '', homework: '', status: 'planned' });
      setEditingId(null);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to update lesson plan.'),
  });

  const deletePlan = useMutation({
    mutationFn: async (id) => axios.delete(`/timetable/lesson-plans/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lesson-plans'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.schedule || !form.lesson_date || !form.topic) {
      setError('Schedule, date, and topic are required.');
      return;
    }
    const payload = {
      schedule: form.schedule,
      lesson_date: form.lesson_date,
      topic: form.topic.trim(),
      objectives: form.objectives || '',
      materials: form.materials || '',
      homework: form.homework || '',
      status: form.status,
    };
    if (editingId) {
      updatePlan.mutate({ id: editingId, payload });
    } else {
      createPlan.mutate(payload);
    }
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      schedule: plan.schedule,
      lesson_date: plan.lesson_date || '',
      topic: plan.topic || '',
      objectives: plan.objectives || '',
      materials: plan.materials || '',
      homework: plan.homework || '',
      status: plan.status || 'planned',
    });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Lesson Plans</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Create Lesson Plan</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Schedule"
                value={form.schedule}
                onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
              >
                {schedules.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.class_name}{s.section ? ` ${s.section}` : ''} • {s.subject_name} • {dayLabels[s.day_of_week] || s.day_of_week} P{s.period}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                InputLabelProps={{ shrink: true }}
                value={form.lesson_date}
                onChange={(e) => setForm((p) => ({ ...p, lesson_date: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Topic"
                value={form.topic}
                onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value="planned">Planned</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="skipped">Skipped</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Objectives"
                value={form.objectives}
                onChange={(e) => setForm((p) => ({ ...p, objectives: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Materials"
                value={form.materials}
                onChange={(e) => setForm((p) => ({ ...p, materials: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Homework"
                value={form.homework}
                onChange={(e) => setForm((p) => ({ ...p, homework: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" type="submit" disabled={createPlan.isPending || updatePlan.isPending}>
                {editingId ? 'Update' : 'Add'}
              </Button>
              {editingId && (
                <Button fullWidth sx={{ mt: 1 }} onClick={() => {
                  setEditingId(null);
                  setForm({ schedule: '', lesson_date: '', topic: '', objectives: '', materials: '', homework: '', status: 'planned' });
                }}>
                  Cancel
                </Button>
              )}
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Lesson Plans</Typography>
        <Divider sx={{ mb: 2 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Topic</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>{plan.lesson_date}</TableCell>
                <TableCell>{plan.schedule_details?.class_name}{plan.schedule_details?.section ? ` ${plan.schedule_details.section}` : ''}</TableCell>
                <TableCell>{plan.schedule_details?.subject_name}</TableCell>
                <TableCell>{plan.topic}</TableCell>
                <TableCell>{plan.status}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(plan)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => {
                    if (window.confirm('Delete this lesson plan?')) {
                      deletePlan.mutate(plan.id);
                    }
                  }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">No lesson plans yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default LessonPlans;

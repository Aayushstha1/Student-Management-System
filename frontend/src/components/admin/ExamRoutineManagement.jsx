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
  Divider,
  IconButton,
  Chip,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const examTypeOptions = [
  { value: 'unit_test', label: 'Unit Test' },
  { value: 'mid_term', label: 'Mid Term' },
  { value: 'final', label: 'Final Exam' },
  { value: 'pre_board', label: 'Pre-Board' },
  { value: 'practical', label: 'Practical' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'project', label: 'Project' },
];

const ExamRoutineManagement = () => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    class_name: '',
    section: '',
    subject: '',
    exam_type: 'mid_term',
    exam_date: '',
    start_time: '',
    end_time: '',
    total_marks: '',
    passing_marks: '',
    is_active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => (await axios.get('/results/exams/')).data,
  });

  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects'],
    queryFn: async () => (await axios.get('/results/class-subjects/')).data,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => (await axios.get('/attendance/subjects/')).data,
  });

  const exams = useMemo(() => normalizeList(examsData), [examsData]);
  const classSubjects = useMemo(() => normalizeList(classSubjectsData), [classSubjectsData]);
  const subjects = useMemo(() => normalizeList(subjectsData), [subjectsData]);

  const subjectById = useMemo(() => {
    const map = new Map();
    subjects.forEach((s) => map.set(String(s.id), s));
    return map;
  }, [subjects]);

  const classOptions = useMemo(() => {
    const unique = new Set(classSubjects.map((c) => c.class_name).filter(Boolean));
    return Array.from(unique);
  }, [classSubjects]);

  const sectionOptions = useMemo(() => {
    if (!form.class_name) return [];
    const unique = new Set(
      classSubjects
        .filter((c) => c.class_name === form.class_name)
        .map((c) => c.section || '')
    );
    return Array.from(unique);
  }, [classSubjects, form.class_name]);

  const subjectOptions = useMemo(() => {
    if (!form.class_name) return subjects;
    const matches = classSubjects.filter(
      (c) => c.class_name === form.class_name && (form.section ? (c.section || '') === form.section : true)
    );
    if (matches.length === 0) return subjects;
    const uniqueIds = new Set(matches.map((m) => String(m.subject)));
    return subjects.filter((s) => uniqueIds.has(String(s.id)));
  }, [classSubjects, subjects, form.class_name, form.section]);

  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (!e.class_name) return false;
      if (filterClass && String(e.class_name || '') !== String(filterClass)) return false;
      if (filterSection && String(e.section || '') !== String(filterSection)) return false;
      return true;
    });
  }, [exams, filterClass, filterSection]);

  const createExam = useMutation({
    mutationFn: async (payload) => (await axios.post('/results/exams/', payload)).data,
    onSuccess: () => {
      setForm((prev) => ({
        class_name: prev.class_name,
        section: prev.section,
        subject: '',
        exam_type: 'mid_term',
        exam_date: '',
        start_time: '',
        end_time: '',
        total_marks: '',
        passing_marks: '',
        is_active: true,
      }));
      setEditingId(null);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to save exam routine.'),
  });

  const updateExam = useMutation({
    mutationFn: async ({ id, payload }) => (await axios.patch(`/results/exams/${id}/`, payload)).data,
    onSuccess: () => {
      setForm((prev) => ({
        class_name: prev.class_name,
        section: prev.section,
        subject: '',
        exam_type: 'mid_term',
        exam_date: '',
        start_time: '',
        end_time: '',
        total_marks: '',
        passing_marks: '',
        is_active: true,
      }));
      setEditingId(null);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to update exam routine.'),
  });

  const deleteExam = useMutation({
    mutationFn: async (id) => axios.delete(`/results/exams/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.class_name || !form.subject || !form.exam_date || !form.total_marks || !form.passing_marks) {
      setError('Class, subject, date, total marks, and passing marks are required.');
      return;
    }
    const subject = subjectById.get(String(form.subject));
    const typeLabel = examTypeOptions.find((t) => t.value === form.exam_type)?.label || 'Exam';
    const autoName = `${subject?.name || 'Exam'} - ${typeLabel}`;
    const payload = {
      class_name: form.class_name,
      section: form.section || '',
      subject: form.subject,
      name: autoName,
      exam_type: form.exam_type,
      exam_date: form.exam_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      total_marks: Number(form.total_marks),
      passing_marks: Number(form.passing_marks),
      topic: '',
      is_active: form.is_active,
    };
    if (editingId) {
      updateExam.mutate({ id: editingId, payload });
    } else {
      createExam.mutate(payload);
    }
  };

  const handleEdit = (exam) => {
    setEditingId(exam.id);
    setForm({
      class_name: exam.class_name || '',
      section: exam.section || '',
      subject: exam.subject || '',
      exam_type: exam.exam_type || 'mid_term',
      exam_date: exam.exam_date || '',
      start_time: exam.start_time || '',
      end_time: exam.end_time || '',
      total_marks: exam.total_marks || '',
      passing_marks: exam.passing_marks || '',
      is_active: exam.is_active !== false,
    });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Exam Routine</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Create Exam Routine</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Class"
                value={form.class_name}
                onChange={(e) => setForm((p) => ({ ...p, class_name: e.target.value }))}
                placeholder="12"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select={sectionOptions.length > 0}
                fullWidth
                label="Section"
                value={form.section}
                onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
              >
                {sectionOptions.length === 0 ? null : (
                  sectionOptions.map((sec) => (
                    <MenuItem key={sec || '__none__'} value={sec}>{sec || '-'}</MenuItem>
                  ))
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Subject"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              >
                {subjectOptions.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.code ? `${s.code} - ${s.name}` : s.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Exam Type"
                value={form.exam_type}
                onChange={(e) => setForm((p) => ({ ...p, exam_type: e.target.value }))}
              >
                {examTypeOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Exam Date"
                InputLabelProps={{ shrink: true }}
                value={form.exam_date}
                onChange={(e) => setForm((p) => ({ ...p, exam_date: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="time"
                label="Start Time"
                InputLabelProps={{ shrink: true }}
                value={form.start_time}
                onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="time"
                label="End Time"
                InputLabelProps={{ shrink: true }}
                value={form.end_time}
                onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Total Marks"
                value={form.total_marks}
                onChange={(e) => setForm((p) => ({ ...p, total_marks: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Passing Marks"
                value={form.passing_marks}
                onChange={(e) => setForm((p) => ({ ...p, passing_marks: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <TextField
                select
                fullWidth
                label="Active"
                value={form.is_active ? 'true' : 'false'}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" type="submit" disabled={createExam.isPending || updateExam.isPending}>
                {editingId ? 'Update' : 'Add'}
              </Button>
              {editingId && (
                <Button fullWidth sx={{ mt: 1 }} onClick={() => {
                  setEditingId(null);
                  setForm({
                    class_name: '',
                    section: '',
                    subject: '',
                    name: '',
                    exam_type: 'mid_term',
                    exam_date: '',
                    total_marks: '',
                    passing_marks: '',
                    topic: '',
                    is_active: true,
                  });
                }}>
                  Cancel
                </Button>
              )}
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Filter Class"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Filter Section"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
            />
          </Grid>
        </Grid>

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
                <TableCell>Active</TableCell>
                <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredExams.map((exam) => {
              const subject = subjectById.get(String(exam.subject));
              return (
                <TableRow key={exam.id}>
                  <TableCell>{exam.class_name || '-'}</TableCell>
                  <TableCell>{exam.section || '-'}</TableCell>
                  <TableCell>{exam.subject_name || subject?.name || exam.subject}</TableCell>
                  <TableCell>{examTypeOptions.find((t) => t.value === exam.exam_type)?.label || exam.exam_type}</TableCell>
                  <TableCell>{exam.exam_date}</TableCell>
                  <TableCell>
                    {exam.start_time || exam.end_time
                      ? `${exam.start_time || '--:--'} - ${exam.end_time || '--:--'}`
                      : '-'}
                  </TableCell>
                  <TableCell align="right">{exam.total_marks}</TableCell>
                  <TableCell align="right">{exam.passing_marks}</TableCell>
                  <TableCell>
                    <Chip label={exam.is_active ? 'Active' : 'Inactive'} size="small" color={exam.is_active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(exam)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => {
                      if (window.confirm('Delete this exam?')) {
                        deleteExam.mutate(exam.id);
                      }
                    }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredExams.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">No exams found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default ExamRoutineManagement;

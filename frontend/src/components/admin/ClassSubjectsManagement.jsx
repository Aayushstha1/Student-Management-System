import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const ClassSubjectsManagement = () => {
  const queryClient = useQueryClient();
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const normalizeClassInput = (rawClassName, rawSection) => {
    let value = String(rawClassName || '').trim();
    value = value.replace(/^(class|cls)\s*[-:_]*\s*/i, '');
    value = value.replace(/[/_-]+/g, ' ');
    value = value.replace(/(\d)([A-Za-z])/g, '$1 $2');
    value = value.replace(/\s+/g, ' ').trim();

    let sectionValue = String(rawSection || '').trim();
    if (value && /^\d/.test(value) && !sectionValue) {
      const parts = value.split(' ');
      const last = parts[parts.length - 1];
      if (/^[A-Za-z]{1,3}$/.test(last)) {
        sectionValue = last.toUpperCase();
        parts.pop();
        value = parts.join(' ').trim();
      }
    }

    if (sectionValue) {
      sectionValue = sectionValue.toUpperCase();
    }

    return { className: value, section: sectionValue };
  };

  const getErrorMessage = (err, fallback) => {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.non_field_errors) {
      return Array.isArray(data.non_field_errors)
        ? data.non_field_errors.join(' ')
        : String(data.non_field_errors);
    }
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const value = data[firstKey];
      if (Array.isArray(value)) return value.join(' ');
      if (value && typeof value === 'object' && value.detail) return value.detail;
      return String(value);
    }
    return fallback;
  };

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['class-subject-assignments'],
    queryFn: async () => {
      const resp = await axios.get('results/class-subjects/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const resp = await axios.get('attendance/subjects/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const resp = await axios.get('teachers/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        class_name: className.trim(),
        section: section.trim(),
        subject: subjectId,
        teacher: teacherId || null,
        is_active: isActive,
      };
      return axios.post('results/class-subjects/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['class-subject-assignments']);
      queryClient.invalidateQueries(['class-subjects']);
      setSuccess('Assignment created successfully.');
      setError('');
      setClassName('');
      setSection('');
      setSubjectId('');
      setTeacherId('');
      setIsActive(true);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Failed to create assignment.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id) => {
      const payload = {
        class_name: className.trim(),
        section: section.trim(),
        subject: subjectId,
        is_active: isActive,
      };
      if (teacherId !== '') {
        payload.teacher = teacherId || null;
      }
      return axios.patch(`results/class-subjects/${id}/`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['class-subject-assignments']);
      queryClient.invalidateQueries(['class-subjects']);
      setSuccess('Assignment updated successfully.');
      setError('');
      setClassName('');
      setSection('');
      setSubjectId('');
      setTeacherId('');
      setIsActive(true);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Failed to update assignment.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => axios.delete(`results/class-subjects/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries(['class-subject-assignments']);
      queryClient.invalidateQueries(['class-subjects']);
    },
  });

  const handleCreate = () => {
    if (!className.trim() || !subjectId) {
      setError('Class and subject are required.');
      return;
    }
    const input = normalizeClassInput(className, section);
    const existing = assignmentsArray.find((a) => {
      const normalized = normalizeClassInput(a.class_name, a.section || '');
      return (
        normalized.className.toLowerCase() === input.className.toLowerCase() &&
        normalized.section.toLowerCase() === input.section.toLowerCase() &&
        String(a.subject) === String(subjectId)
      );
    });

    if (existing) {
      updateMutation.mutate(existing.id);
      return;
    }

    createMutation.mutate();
  };

  const assignmentsArray = useMemo(() => {
    if (Array.isArray(assignments)) return assignments;
    if (assignments && Array.isArray(assignments.results)) return assignments.results;
    return [];
  }, [assignments]);

  const subjectsArray = useMemo(() => {
    if (Array.isArray(subjectsData)) return subjectsData;
    if (subjectsData && Array.isArray(subjectsData.results)) return subjectsData.results;
    return [];
  }, [subjectsData]);

  const teachersArray = useMemo(() => {
    if (Array.isArray(teachersData)) return teachersData;
    if (teachersData && Array.isArray(teachersData.results)) return teachersData.results;
    return [];
  }, [teachersData]);

  const sortedAssignments = useMemo(() => {
    return assignmentsArray.slice().sort((a, b) => {
      const cls = String(a.class_name).localeCompare(String(b.class_name));
      if (cls !== 0) return cls;
      return String(a.section || '').localeCompare(String(b.section || ''));
    });
  }, [assignmentsArray]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Class Subject Assignments
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Assign fixed subjects and teachers per class/section.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Assign Subject to Class
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Class"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Section (optional)"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Subject</InputLabel>
              <Select
                value={subjectId}
                label="Subject"
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjectsArray.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Teacher (optional)</InputLabel>
              <Select
                value={teacherId}
                label="Teacher (optional)"
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <MenuItem value="">
                  Unassigned
                </MenuItem>
                {teachersArray.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.user_details?.first_name} {t.user_details?.last_name} ({t.employee_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} display="flex" alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label="Active"
            />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={handleCreate}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Saving...' : 'Save Assignment'}
        </Button>

        {subjectsArray.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No subjects found. Please create subjects first.
          </Alert>
        )}
        {teachersArray.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No teachers found. You can still assign subjects without a teacher.
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Existing Assignments
        </Typography>
        {assignmentsLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : sortedAssignments.length === 0 ? (
          <Typography color="text.secondary">No class subject assignments yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell><strong>Class</strong></TableCell>
                  <TableCell><strong>Section</strong></TableCell>
                  <TableCell><strong>Subject</strong></TableCell>
                  <TableCell><strong>Teacher</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="right"><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.class_name}</TableCell>
                    <TableCell>{a.section || '-'}</TableCell>
                    <TableCell>{a.subject_code ? `${a.subject_code} - ${a.subject_name}` : a.subject_name}</TableCell>
                    <TableCell>{a.teacher_name || 'Unassigned'}</TableCell>
                    <TableCell>{a.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="error"
                        onClick={() => deleteMutation.mutate(a.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default ClassSubjectsManagement;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  EventSeat as SeatIcon,
} from '@mui/icons-material';
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

const seatPatternOptions = [
  { value: 'row_wise', label: 'Row Wise' },
  { value: 'serpentine', label: 'Serpentine Rows' },
  { value: 'checkerboard', label: 'Checkerboard Spacing' },
];

const distributionOptions = [
  { value: 'balanced', label: 'Balanced Across Rooms' },
  { value: 'room_fill', label: 'Fill One Room First' },
];

const emptyExamForm = {
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
};

const emptyRoomForm = {
  name: '',
  building: '',
  rows: 5,
  columns: 6,
  capacity: 30,
  is_active: true,
};

const ExamRoutineManagement = () => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyExamForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [roomSuccess, setRoomSuccess] = useState('');

  const [selectedPlanExamId, setSelectedPlanExamId] = useState('');
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [distribution, setDistribution] = useState('balanced');
  const [seatPattern, setSeatPattern] = useState('row_wise');
  const [plannerError, setPlannerError] = useState('');
  const [plannerSuccess, setPlannerSuccess] = useState('');
  const [assignmentRoomFilter, setAssignmentRoomFilter] = useState('');

  const { data: examsData, isLoading: examsLoading } = useQuery({
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

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['exam-rooms'],
    queryFn: async () => (await axios.get('/results/exam-rooms/')).data,
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['seat-assignments', selectedPlanExamId],
    queryFn: async () => (
      await axios.get('/results/seat-assignments/', { params: { exam: selectedPlanExamId } })
    ).data,
    enabled: Boolean(selectedPlanExamId),
  });

  const exams = useMemo(() => normalizeList(examsData), [examsData]);
  const classSubjects = useMemo(() => normalizeList(classSubjectsData), [classSubjectsData]);
  const subjects = useMemo(() => normalizeList(subjectsData), [subjectsData]);
  const rooms = useMemo(() => normalizeList(roomsData), [roomsData]);
  const assignments = useMemo(() => normalizeList(assignmentsData), [assignmentsData]);

  useEffect(() => {
    setSelectedRooms((previous) =>
      previous.filter((selectedRoom) => rooms.some((room) => room.id === selectedRoom.id)),
    );
  }, [rooms]);

  const subjectById = useMemo(() => {
    const map = new Map();
    subjects.forEach((subject) => map.set(String(subject.id), subject));
    return map;
  }, [subjects]);

  const classOptions = useMemo(() => {
    const unique = new Set(classSubjects.map((item) => item.class_name).filter(Boolean));
    return Array.from(unique);
  }, [classSubjects]);

  const sectionOptions = useMemo(() => {
    if (!form.class_name) return [];
    const unique = new Set(
      classSubjects
        .filter((item) => item.class_name === form.class_name)
        .map((item) => item.section || ''),
    );
    return Array.from(unique);
  }, [classSubjects, form.class_name]);

  const subjectOptions = useMemo(() => {
    if (!form.class_name) return subjects;
    const matches = classSubjects.filter(
      (item) =>
        item.class_name === form.class_name &&
        (form.section ? (item.section || '') === form.section : true),
    );
    if (matches.length === 0) return subjects;
    const allowedSubjectIds = new Set(matches.map((item) => String(item.subject)));
    return subjects.filter((subject) => allowedSubjectIds.has(String(subject.id)));
  }, [classSubjects, subjects, form.class_name, form.section]);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (!exam.class_name) return false;
      if (filterClass && String(exam.class_name) !== String(filterClass)) return false;
      if (filterSection && String(exam.section || '') !== String(filterSection)) return false;
      return true;
    });
  }, [exams, filterClass, filterSection]);

  const selectedPlanExam = useMemo(
    () => exams.find((exam) => String(exam.id) === String(selectedPlanExamId)) || null,
    [exams, selectedPlanExamId],
  );

  const activeRooms = useMemo(
    () => rooms.filter((room) => room.is_active !== false),
    [rooms],
  );

  const assignmentRoomOptions = useMemo(() => {
    const unique = new Map();
    assignments.forEach((assignment) => {
      if (!unique.has(assignment.room_name)) {
        unique.set(assignment.room_name, assignment.room_name);
      }
    });
    return Array.from(unique.values());
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      if (!assignmentRoomFilter) return true;
      return assignment.room_name === assignmentRoomFilter;
    });
  }, [assignments, assignmentRoomFilter]);

  const assignmentCountsByRoom = useMemo(() => {
    return filteredAssignments.reduce((accumulator, assignment) => {
      accumulator[assignment.room_name] = (accumulator[assignment.room_name] || 0) + 1;
      return accumulator;
    }, {});
  }, [filteredAssignments]);

  const createExam = useMutation({
    mutationFn: async (payload) => (await axios.post('/results/exams/', payload)).data,
    onSuccess: () => {
      setForm((previous) => ({
        ...emptyExamForm,
        class_name: previous.class_name,
        section: previous.section,
      }));
      setEditingId(null);
      setError('');
      setSuccess('Exam routine saved.');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (mutationError) => {
      const conflictMessage =
        mutationError.response?.data?.detail ||
        mutationError.response?.data?.passing_marks?.[0] ||
        'Failed to save exam routine.';
      setError(conflictMessage);
    },
  });

  const updateExam = useMutation({
    mutationFn: async ({ id, payload }) => (await axios.patch(`/results/exams/${id}/`, payload)).data,
    onSuccess: () => {
      setForm((previous) => ({
        ...emptyExamForm,
        class_name: previous.class_name,
        section: previous.section,
      }));
      setEditingId(null);
      setError('');
      setSuccess('Exam routine updated.');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (mutationError) => {
      const conflictMessage =
        mutationError.response?.data?.detail ||
        mutationError.response?.data?.passing_marks?.[0] ||
        'Failed to update exam routine.';
      setError(conflictMessage);
    },
  });

  const deleteExam = useMutation({
    mutationFn: async (id) => axios.delete(`/results/exams/${id}/`),
    onSuccess: () => {
      setSuccess('Exam routine deleted.');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: () => setError('Failed to delete exam routine.'),
  });

  const saveRoom = useMutation({
    mutationFn: async ({ id, payload }) => {
      if (id) {
        return (await axios.patch(`/results/exam-rooms/${id}/`, payload)).data;
      }
      return (await axios.post('/results/exam-rooms/', payload)).data;
    },
    onSuccess: () => {
      setRoomForm(emptyRoomForm);
      setEditingRoomId(null);
      setRoomError('');
      setRoomSuccess('Exam room saved.');
      queryClient.invalidateQueries({ queryKey: ['exam-rooms'] });
    },
    onError: (mutationError) => {
      const responseData = mutationError.response?.data || {};
      const message =
        responseData.detail ||
        responseData.name?.[0] ||
        responseData.capacity?.[0] ||
        responseData.rows?.[0] ||
        responseData.columns?.[0] ||
        'Failed to save exam room.';
      setRoomError(message);
    },
  });

  const deleteRoom = useMutation({
    mutationFn: async (id) => axios.delete(`/results/exam-rooms/${id}/`),
    onSuccess: () => {
      setRoomSuccess('Exam room deleted.');
      queryClient.invalidateQueries({ queryKey: ['exam-rooms'] });
    },
    onError: () => setRoomError('Failed to delete exam room.'),
  });

  const generateSeatPlan = useMutation({
    mutationFn: async (payload) => (await axios.post('/results/seat-plans/generate/', payload)).data,
    onSuccess: (response) => {
      setPlannerError('');
      setPlannerSuccess(response.detail || 'Seat plan generated.');
      queryClient.invalidateQueries({ queryKey: ['seat-assignments', selectedPlanExamId] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (mutationError) => {
      setPlannerError(mutationError.response?.data?.detail || 'Failed to generate seat plan.');
    },
  });

  const clearSeatPlan = useMutation({
    mutationFn: async (payload) => (await axios.post('/results/seat-plans/clear/', payload)).data,
    onSuccess: () => {
      setPlannerError('');
      setPlannerSuccess('Seat plan cleared.');
      queryClient.invalidateQueries({ queryKey: ['seat-assignments', selectedPlanExamId] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (mutationError) => {
      setPlannerError(mutationError.response?.data?.detail || 'Failed to clear seat plan.');
    },
  });

  const resetExamForm = () => {
    setEditingId(null);
    setForm(emptyExamForm);
    setError('');
  };

  const resetRoomForm = () => {
    setEditingRoomId(null);
    setRoomForm(emptyRoomForm);
    setRoomError('');
  };

  const handleExamSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!form.class_name || !form.subject || !form.exam_date || !form.total_marks || !form.passing_marks) {
      setError('Class, subject, date, total marks, and passing marks are required.');
      return;
    }

    const subject = subjectById.get(String(form.subject));
    const typeLabel = examTypeOptions.find((item) => item.value === form.exam_type)?.label || 'Exam';
    const payload = {
      class_name: form.class_name,
      section: form.section || '',
      subject: form.subject,
      name: `${subject?.name || 'Exam'} - ${typeLabel}`,
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

  const handleRoomSubmit = (event) => {
    event.preventDefault();
    setRoomError('');

    if (!roomForm.name || !roomForm.rows || !roomForm.columns || !roomForm.capacity) {
      setRoomError('Name, rows, columns, and capacity are required.');
      return;
    }

    saveRoom.mutate({
      id: editingRoomId,
      payload: {
        name: roomForm.name,
        building: roomForm.building,
        rows: Number(roomForm.rows),
        columns: Number(roomForm.columns),
        capacity: Number(roomForm.capacity),
        is_active: roomForm.is_active,
      },
    });
  };

  const handleEditExam = (exam) => {
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
    setError('');
  };

  const handleEditRoom = (room) => {
    setEditingRoomId(room.id);
    setRoomForm({
      name: room.name || '',
      building: room.building || '',
      rows: room.rows || 5,
      columns: room.columns || 6,
      capacity: room.capacity || 30,
      is_active: room.is_active !== false,
    });
    setRoomError('');
  };

  const handleGenerateSeatPlan = () => {
    setPlannerError('');
    if (!selectedPlanExamId) {
      setPlannerError('Select an exam before generating a seat plan.');
      return;
    }
    if (selectedRooms.length === 0) {
      setPlannerError('Choose at least one room for seat planning.');
      return;
    }

    generateSeatPlan.mutate({
      exam: selectedPlanExamId,
      room_ids: selectedRooms.map((room) => room.id),
      distribution,
      pattern: seatPattern,
      replace_existing: true,
    });
  };

  const handleClearSeatPlan = () => {
    setPlannerError('');
    if (!selectedPlanExamId) {
      setPlannerError('Select an exam before clearing the seat plan.');
      return;
    }

    if (!window.confirm('Clear all seat assignments for this exam?')) {
      return;
    }

    clearSeatPlan.mutate({ exam: selectedPlanExamId });
  };

  if (examsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Exam Routine
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Create Exam Routine
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

        <Box component="form" onSubmit={handleExamSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Class"
                value={form.class_name}
                onChange={(event) => setForm((previous) => ({ ...previous, class_name: event.target.value }))}
                placeholder="12"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select={sectionOptions.length > 0}
                fullWidth
                label="Section"
                value={form.section}
                onChange={(event) => setForm((previous) => ({ ...previous, section: event.target.value }))}
              >
                {sectionOptions.length === 0
                  ? null
                  : sectionOptions.map((section) => (
                      <MenuItem key={section || '__none__'} value={section}>
                        {section || '-'}
                      </MenuItem>
                    ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Subject"
                value={form.subject}
                onChange={(event) => setForm((previous) => ({ ...previous, subject: event.target.value }))}
              >
                {subjectOptions.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id}>
                    {subject.code ? `${subject.code} - ${subject.name}` : subject.name}
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
                onChange={(event) => setForm((previous) => ({ ...previous, exam_type: event.target.value }))}
              >
                {examTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Exam Date"
                InputLabelProps={{ shrink: true }}
                value={form.exam_date}
                onChange={(event) => setForm((previous) => ({ ...previous, exam_date: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="time"
                label="Start Time"
                InputLabelProps={{ shrink: true }}
                value={form.start_time}
                onChange={(event) => setForm((previous) => ({ ...previous, start_time: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="time"
                label="End Time"
                InputLabelProps={{ shrink: true }}
                value={form.end_time}
                onChange={(event) => setForm((previous) => ({ ...previous, end_time: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Total Marks"
                value={form.total_marks}
                onChange={(event) => setForm((previous) => ({ ...previous, total_marks: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Passing Marks"
                value={form.passing_marks}
                onChange={(event) => setForm((previous) => ({ ...previous, passing_marks: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Active"
                value={form.is_active ? 'true' : 'false'}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, is_active: event.target.value === 'true' }))
                }
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={createExam.isPending || updateExam.isPending}
              >
                {editingId ? 'Update' : 'Add'}
              </Button>
              {editingId && (
                <Button fullWidth sx={{ mt: 1 }} onClick={resetExamForm}>
                  Cancel
                </Button>
              )}
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Filter Class"
              value={filterClass}
              onChange={(event) => setFilterClass(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Filter Section"
              value={filterSection}
              onChange={(event) => setFilterSection(event.target.value)}
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
              <TableCell>Seat Plan</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredExams.map((exam) => {
              const subject = subjectById.get(String(exam.subject));
              const seatSummary = exam.seat_plan_summary || {};
              return (
                <TableRow key={exam.id}>
                  <TableCell>{exam.class_name || '-'}</TableCell>
                  <TableCell>{exam.section || '-'}</TableCell>
                  <TableCell>{exam.subject_name || subject?.name || exam.subject}</TableCell>
                  <TableCell>
                    {examTypeOptions.find((item) => item.value === exam.exam_type)?.label || exam.exam_type}
                  </TableCell>
                  <TableCell>{exam.exam_date}</TableCell>
                  <TableCell>
                    {exam.start_time || exam.end_time
                      ? `${exam.start_time || '--:--'} - ${exam.end_time || '--:--'}`
                      : '-'}
                  </TableCell>
                  <TableCell align="right">{exam.total_marks}</TableCell>
                  <TableCell align="right">{exam.passing_marks}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`${seatSummary.assigned_count || 0}/${seatSummary.expected_count || 0}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        color={seatSummary.is_complete ? 'success' : 'warning'}
                        label={seatSummary.is_complete ? 'Ready' : 'Pending'}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={exam.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={exam.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit exam">
                      <IconButton size="small" onClick={() => handleEditExam(exam)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Plan seats">
                      <IconButton
                        size="small"
                        color={String(selectedPlanExamId) === String(exam.id) ? 'primary' : 'default'}
                        onClick={() => {
                          setSelectedPlanExamId(String(exam.id));
                          setPlannerError('');
                          setPlannerSuccess('');
                        }}
                      >
                        <SeatIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete exam">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (window.confirm('Delete this exam?')) {
                            deleteExam.mutate(exam.id);
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredExams.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  No exams found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Exam Rooms
            </Typography>
            {roomError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRoomError('')}>
                {roomError}
              </Alert>
            )}
            {roomSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRoomSuccess('')}>
                {roomSuccess}
              </Alert>
            )}

            <Box component="form" onSubmit={handleRoomSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Room Name"
                    value={roomForm.name}
                    onChange={(event) => setRoomForm((previous) => ({ ...previous, name: event.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Building"
                    value={roomForm.building}
                    onChange={(event) => setRoomForm((previous) => ({ ...previous, building: event.target.value }))}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Rows"
                    value={roomForm.rows}
                    onChange={(event) => setRoomForm((previous) => ({ ...previous, rows: event.target.value }))}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Columns"
                    value={roomForm.columns}
                    onChange={(event) => setRoomForm((previous) => ({ ...previous, columns: event.target.value }))}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Capacity"
                    value={roomForm.capacity}
                    onChange={(event) => setRoomForm((previous) => ({ ...previous, capacity: event.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    select
                    fullWidth
                    label="Active"
                    value={roomForm.is_active ? 'true' : 'false'}
                    onChange={(event) =>
                      setRoomForm((previous) => ({ ...previous, is_active: event.target.value === 'true' }))
                    }
                  >
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    disabled={saveRoom.isPending}
                  >
                    {editingRoomId ? 'Update Room' : 'Add Room'}
                  </Button>
                  {editingRoomId && (
                    <Button fullWidth sx={{ mt: 1 }} onClick={resetRoomForm}>
                      Cancel
                    </Button>
                  )}
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 3 }} />

            {roomsLoading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={26} />
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Room</TableCell>
                    <TableCell align="right">Grid</TableCell>
                    <TableCell align="right">Capacity</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {room.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {room.building || 'Main block'} • {room.is_active ? 'Active' : 'Inactive'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {room.rows} x {room.columns}
                      </TableCell>
                      <TableCell align="right">{room.capacity}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditRoom(room)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm('Delete this room?')) {
                              deleteRoom.mutate(room.id);
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rooms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No rooms created yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Advanced Seat Planning
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select an exam, choose one or more rooms, then generate an optimized seating layout.
            </Typography>

            {plannerError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPlannerError('')}>
                {plannerError}
              </Alert>
            )}
            {plannerSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPlannerSuccess('')}>
                {plannerSuccess}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="Exam"
                  value={selectedPlanExamId}
                  onChange={(event) => {
                    setSelectedPlanExamId(event.target.value);
                    setPlannerError('');
                    setPlannerSuccess('');
                  }}
                >
                  {exams.map((exam) => (
                    <MenuItem key={exam.id} value={String(exam.id)}>
                      {`${exam.class_name || '-'}${exam.section ? ` ${exam.section}` : ''} • ${exam.subject_name || exam.name}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  multiple
                  options={activeRooms}
                  value={selectedRooms}
                  onChange={(event, nextValue) => setSelectedRooms(nextValue)}
                  getOptionLabel={(option) =>
                    `${option.name} (${option.capacity} seats${option.building ? `, ${option.building}` : ''})`
                  }
                  renderInput={(params) => <TextField {...params} label="Rooms" />}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  select
                  fullWidth
                  label="Distribution"
                  value={distribution}
                  onChange={(event) => setDistribution(event.target.value)}
                >
                  {distributionOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  select
                  fullWidth
                  label="Pattern"
                  value={seatPattern}
                  onChange={(event) => setSeatPattern(event.target.value)}
                >
                  {seatPatternOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<SeatIcon />}
                onClick={handleGenerateSeatPlan}
                disabled={generateSeatPlan.isPending || !selectedPlanExamId}
              >
                Generate Seat Plan
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleClearSeatPlan}
                disabled={clearSeatPlan.isPending || !selectedPlanExamId}
              >
                Clear Plan
              </Button>
            </Stack>

            {selectedPlanExam ? (
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                  <Chip
                    label={`Class ${selectedPlanExam.class_name || '-'}${selectedPlanExam.section ? ` ${selectedPlanExam.section}` : ''}`}
                    variant="outlined"
                  />
                  <Chip label={selectedPlanExam.subject_name || selectedPlanExam.name} variant="outlined" />
                  <Chip label={`${selectedPlanExam.seat_plan_summary?.expected_count || 0} students`} />
                  <Chip
                    label={`${selectedPlanExam.seat_plan_summary?.assigned_count || 0} assigned`}
                    color={selectedPlanExam.seat_plan_summary?.is_complete ? 'success' : 'warning'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Use checkerboard mode when you want physical spacing, or balanced mode when you want room occupancy kept even.
                </Typography>
              </Box>
            ) : (
              <Alert severity="info" sx={{ mb: 3 }}>
                Pick an exam above to generate or inspect its seating layout.
              </Alert>
            )}

            <Divider sx={{ mb: 2 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1">Seat Assignment Preview</Typography>
              <TextField
                select={assignmentRoomOptions.length > 0}
                label="Filter Room"
                size="small"
                value={assignmentRoomFilter}
                onChange={(event) => setAssignmentRoomFilter(event.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">All Rooms</MenuItem>
                {assignmentRoomOptions.map((roomName) => (
                  <MenuItem key={roomName} value={roomName}>
                    {roomName}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {assignmentsLoading ? (
              <Box display="flex" justifyContent="center" py={5}>
                <CircularProgress />
              </Box>
            ) : assignments.length === 0 ? (
              <Alert severity="info">
                No seat assignments generated for this exam yet.
              </Alert>
            ) : (
              <>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                  {Object.entries(assignmentCountsByRoom).map(([roomName, count]) => (
                    <Chip key={roomName} label={`${roomName}: ${count}`} variant="outlined" />
                  ))}
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Student ID</TableCell>
                      <TableCell>Roll</TableCell>
                      <TableCell>Room</TableCell>
                      <TableCell>Seat</TableCell>
                      <TableCell>Grid Position</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.student_name || '-'}</TableCell>
                        <TableCell>{assignment.student_id || '-'}</TableCell>
                        <TableCell>{assignment.roll_number || '-'}</TableCell>
                        <TableCell>{assignment.room_name || '-'}</TableCell>
                        <TableCell>
                          <Chip label={assignment.seat_label || assignment.seat_number} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          Row {assignment.row_number}, Column {assignment.column_number}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAssignments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No seat assignments match this filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ExamRoutineManagement;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
  CircularProgress,
  Divider,
  Avatar,
  Stack,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const Attendance = () => {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    class_name: '',
    section: '',
    period: 1,
    subject: '',
  });
  const [students, setStudents] = useState([]);
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [leaveSet, setLeaveSet] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: subjectsData } = useQuery({
    queryKey: ['attendance-subjects'],
    queryFn: async () => (await axios.get('attendance/subjects/')).data,
  });

  const subjects = Array.isArray(subjectsData) ? subjectsData : subjectsData?.results || [];
  const mediaBase = (axios.defaults.baseURL || '').replace('/api', '');

  useEffect(() => {
    if (!form.subject && subjects.length > 0) {
      setForm((prev) => ({ ...prev, subject: subjects[0].id }));
    }
  }, [form.subject, subjects]);

  const handleInputChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const loadStudents = async () => {
    setError('');
    setSuccess('');
    if (!form.date || !form.class_name || !form.section) {
      setError('Date, class, and section are required.');
      return;
    }
    if (!form.subject) {
      setError('No subject found. Please create a subject first.');
      return;
    }

    setLoading(true);
    try {
      let session = null;
      try {
        const resp = await axios.post('attendance/sessions/', {
          date: form.date,
          period: Number(form.period),
          class_name: form.class_name,
          section: form.section,
          subject: form.subject,
        });
        session = resp.data;
      } catch (err) {
        const isDuplicate = err.response?.data?.non_field_errors || err.response?.data?.detail;
        if (err.response?.status === 400 && isDuplicate) {
          const resp = await axios.get('attendance/sessions/', { params: { date: form.date } });
          const list = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
          session = list.find(
            (s) =>
              String(s.class_name) === String(form.class_name) &&
              String(s.section) === String(form.section) &&
              Number(s.period) === Number(form.period) &&
              Number(s.subject) === Number(form.subject)
          );
          if (!session) {
            throw new Error('Attendance session already exists but could not be found.');
          }
        } else {
          throw err;
        }
      }

      setSessionId(session?.id || null);

      const studentsResp = await axios.get('students/', {
        params: { class: form.class_name, section: form.section },
      });
      const studentList = Array.isArray(studentsResp.data)
        ? studentsResp.data
        : studentsResp.data?.results || [];
      setStudents(studentList);

      const leavesResp = await axios.get('attendance/leaves/', {
        params: {
          status: 'approved',
          date: form.date,
          class: form.class_name,
          section: form.section,
        },
      });
      const leaveList = Array.isArray(leavesResp.data)
        ? leavesResp.data
        : leavesResp.data?.results || [];
      const leaveIds = new Set(leaveList.map((l) => l.student));
      setLeaveSet(leaveIds);

      const initial = {};
      studentList.forEach((student) => {
        initial[student.id] = leaveIds.has(student.id) ? 'excused' : 'present';
      });
      setAttendanceMarks(initial);
    } catch (err) {
      const msg =
        typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : err.response?.data?.detail || err.message || 'Failed to load students.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, status) => {
    setAttendanceMarks((prev) => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = async () => {
    if (!sessionId || students.length === 0) {
      setError('Please load students before submitting attendance.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const marks = students.map((student) => ({
        student: student.id,
        status: attendanceMarks[student.id] || 'present',
      }));
      await axios.post('attendance/mark/bulk/', {
        session: sessionId,
        marks,
      });
      setSuccess('Attendance saved successfully.');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      const msg =
        typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : err.response?.data?.detail || 'Failed to save attendance.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = useMemo(
    () => [
      { value: 'present', label: 'Present' },
      { value: 'absent', label: 'Absent' },
      { value: 'late', label: 'Late' },
      { value: 'excused', label: 'Leave' },
    ],
    []
  );

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    students.forEach((student) => {
      const status = attendanceMarks[student.id] || 'present';
      if (counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [students, attendanceMarks]);

  const getStatusStyles = (status) => {
    switch (status) {
      case 'present':
        return { bgcolor: 'rgba(46, 125, 50, 0.12)', color: 'success.dark', borderColor: 'success.light' };
      case 'late':
        return { bgcolor: 'rgba(255, 179, 0, 0.16)', color: 'warning.dark', borderColor: 'warning.light' };
      case 'absent':
        return { bgcolor: 'rgba(211, 47, 47, 0.12)', color: 'error.dark', borderColor: 'error.light' };
      case 'excused':
        return { bgcolor: 'rgba(25, 118, 210, 0.12)', color: 'info.dark', borderColor: 'info.light' };
      default:
        return {};
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const aRoll = parseInt(a.roll_number, 10);
      const bRoll = parseInt(b.roll_number, 10);
      const aValid = Number.isFinite(aRoll);
      const bValid = Number.isFinite(bRoll);
      if (aValid && bValid) return aRoll - bRoll;
      if (aValid) return -1;
      if (bValid) return 1;
      return String(a.student_id || '').localeCompare(String(b.student_id || ''));
    });
  }, [students]);

  const getAvatarUrl = (student) => {
    const direct = student.profile_picture_url || student.user_details?.profile_picture;
    if (!direct) return '';
    if (direct.startsWith('http')) return direct;
    return `${mediaBase}${direct}`;
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Attendance
      </Typography>

      <Paper
        sx={{
          p: 2.5,
          mb: 2,
          borderRadius: 3,
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          background: '#fff',
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Take Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select class and section to load students for daily attendance.
          </Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleInputChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Class"
              name="class_name"
              value={form.class_name}
              onChange={handleInputChange}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Section"
              name="section"
              value={form.section}
              onChange={handleInputChange}
            />
          </Grid>
          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button variant="contained" onClick={loadStudents} disabled={loading} fullWidth>
              {loading ? 'Loading...' : 'Load Students'}
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button variant="outlined" onClick={submitAttendance} disabled={saving || students.length === 0} fullWidth>
              {saving ? 'Saving...' : 'Submit Attendance'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
          background: '#fff',
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Student List
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={30} />
          </Box>
        ) : students.length === 0 ? (
          <Typography color="text.secondary">Select class and load students.</Typography>
        ) : (
          <>
            <Box display="flex" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip label={`Present: ${summary.present}`} color="success" size="small" />
              <Chip label={`Late: ${summary.late}`} color="warning" size="small" />
              <Chip label={`Absent: ${summary.absent}`} color="error" size="small" />
              <Chip label={`Leave: ${summary.excused}`} color="info" size="small" />
            </Box>
            <TableContainer sx={{ borderRadius: 2, border: '1px solid #eef2f7' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Roll</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Leave</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedStudents.map((student, idx) => {
                    const onLeave = leaveSet.has(student.id);
                    return (
                      <TableRow
                        key={student.id}
                        sx={{
                          bgcolor: onLeave
                            ? 'rgba(255, 193, 7, 0.12)'
                            : idx % 2 === 0
                              ? 'rgba(0,0,0,0.02)'
                              : 'transparent',
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar src={getAvatarUrl(student)} sx={{ width: 36, height: 36 }}>
                              {(student.user_details?.first_name || student.student_id || 'S')[0]}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {student.user_details?.first_name} {student.user_details?.last_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {student.student_id || '-'}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{student.roll_number || '-'}</TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <Select
                              value={attendanceMarks[student.id] || 'present'}
                              onChange={(e) => handleStatusChange(student.id, e.target.value)}
                              disabled={onLeave}
                              sx={{
                                height: 36,
                                borderRadius: 2,
                                border: '1px solid',
                                ...getStatusStyles(attendanceMarks[student.id] || 'present'),
                                '& .MuiSelect-select': {
                                  py: 0.75,
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontWeight: 600,
                                },
                              }}
                            >
                              {statusOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          {onLeave ? <Chip size="small" color="warning" label="Leave" /> : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default Attendance;



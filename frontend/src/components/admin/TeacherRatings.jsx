import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import axios from 'axios';

const TeacherRatings = () => {
  const [ratings, setRatings] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const loadTeachers = async () => {
    try {
      const res = await axios.get('/teachers/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setTeachers(list);
    } catch {
      setTeachers([]);
    }
  };

  const loadRatings = async (teacherId = '') => {
    try {
      setLoading(true);
      setError('');
      const query = teacherId ? `?teacher_id=${teacherId}` : '';
      const res = await axios.get(`/teachers/ratings/${query}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setRatings(list);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load ratings');
      setRatings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
    loadRatings();
  }, []);

  const handleFilterChange = (e) => {
    const value = e.target.value;
    setTeacherFilter(value);
    loadRatings(value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Teacher Ratings</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <FormControl fullWidth>
          <InputLabel>Filter by Teacher</InputLabel>
          <Select value={teacherFilter} label="Filter by Teacher" onChange={handleFilterChange}>
            <MenuItem value="">All</MenuItem>
            {teachers.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.user_details?.first_name} {t.user_details?.last_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Teacher</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Student ID</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ratings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.teacher_name || '-'}</TableCell>
                  <TableCell>{r.student_name || '-'}</TableCell>
                  <TableCell>{r.student_id || '-'}</TableCell>
                  <TableCell>{r.score}</TableCell>
                  <TableCell>{r.comment || '-'}</TableCell>
                  <TableCell>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
              {ratings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No ratings found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default TeacherRatings;

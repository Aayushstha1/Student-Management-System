import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Grid, Paper, List, ListItem, ListItemText, Divider, Button, Link, CircularProgress, FormControl, InputLabel, MenuItem, Select, Avatar } from '@mui/material';
import { Assessment, LibraryBooks, Grade, School, Note, Campaign, MenuBook, AssignmentTurnedIn, EventAvailable } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import CalendarWidget from '../CalendarWidget';
import { useAuth } from '../../contexts/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const StatCard = ({ icon, label, value, color, to }) => {
  return (
    <Paper
      elevation={2}
      component={to ? RouterLink : 'div'}
      to={to}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 120ms ease',
        '&:hover': { transform: to ? 'translateY(-2px)' : 'none' }
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          bgcolor: `${color}.light`,
          color: `${color}.dark`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 2,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6">{value}</Typography>
      </Box>
    </Paper>
  );
};

const StudentHome = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile-self'],
    queryFn: async () => (await axios.get('/students/profile/')).data,
  });

  const { data: resultsData } = useQuery({
    queryKey: ['student-results'],
    queryFn: async () => (await axios.get('/results/')).data,
  });

  const { data: issuesData } = useQuery({
    queryKey: ['library-issues'],
    queryFn: async () => (await axios.get('/library/issues/')).data,
  });

  const { data: notesData } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => (await axios.get('/notes/')).data,
  });

  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects'],
    queryFn: async () => (await axios.get('/results/class-subjects/')).data,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks-student'],
    queryFn: async () => (await axios.get('/tasks/')).data,
  });

  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => (await axios.get('/results/exams/')).data,
  });

  const { data: libraryStats } = useQuery({
    queryKey: ['library-stats-student'],
    queryFn: async () => (await axios.get('/library/stats/')).data,
  });

  const {
    data: monthlyResponse,
    isLoading: isMonthlyLoading,
    error: monthlyError,
  } = useQuery({
    queryKey: ['attendance-progress-monthly', currentYear, selectedMonth],
    queryFn: async () => (await axios.get(`attendance/progress/monthly/?year=${currentYear}&month=${selectedMonth}`)).data,
  });

  const {
    data: yearlyResponse,
    isLoading: isYearlyLoading,
    error: yearlyError,
  } = useQuery({
    queryKey: ['attendance-progress-yearly', currentYear],
    queryFn: async () => (await axios.get(`attendance/progress/yearly/?year=${currentYear}`)).data,
  });

  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const response = await axios.get('notices/');
      return Array.isArray(response.data) ? response.data.slice(0, 5) : (response.data?.results || []).slice(0, 5);
    },
  });

  const placeholder = '—';
  const studentId = studentProfile?.id;
  const studentClass = studentProfile?.current_class;
  const enrollmentStatus = studentProfile?.is_active ?? user?.is_active;
  const enrollmentValue = enrollmentStatus === undefined ? placeholder : (enrollmentStatus ? 'Active' : 'Inactive');

  const resultsList = useMemo(() => {
    if (Array.isArray(resultsData)) return resultsData;
    return resultsData?.results || [];
  }, [resultsData]);

  const cgpaValue = useMemo(() => {
    if (!resultsList.length) return null;
    const totals = resultsList.reduce((acc, result) => {
      const totalMarks = Number(result.total_marks);
      const obtained = Number(result.marks_obtained);
      if (!totalMarks || Number.isNaN(totalMarks) || Number.isNaN(obtained)) {
        return acc;
      }
      const percentage = (obtained / totalMarks) * 100;
      const cgpa = Math.max(0, Math.min(10, percentage / 10));
      return { sum: acc.sum + cgpa, count: acc.count + 1 };
    }, { sum: 0, count: 0 });
    if (totals.count === 0) return null;
    return (totals.sum / totals.count).toFixed(2);
  }, [resultsList]);

  const issuesList = useMemo(() => {
    if (Array.isArray(issuesData)) return issuesData;
    return issuesData?.results || [];
  }, [issuesData]);

  const studentIssues = useMemo(() => {
    if (!studentId) return [];
    return issuesList.filter((issue) => issue.student === studentId);
  }, [issuesList, studentId]);

  const activeIssues = useMemo(
    () => studentIssues.filter((issue) => issue.status !== 'returned'),
    [studentIssues],
  );

  const notesList = useMemo(() => {
    if (Array.isArray(notesData)) return notesData;
    return notesData?.results || [];
  }, [notesData]);

  const accessibleNotes = useMemo(() => {
    return notesList.filter((note) => {
      if (note.is_active === false) return false;
      const visibility = (note.visibility || 'public').toString().toLowerCase();
      if (visibility === 'public') return true;
      if (visibility === 'class_only') {
        if (!studentClass) return false;
        if (!note.target_class) return true;
        return note.target_class === studentClass;
      }
      if (visibility === 'private' && user?.id) {
        return note.uploaded_by === user.id;
      }
      return true;
    });
  }, [notesList, studentClass, user?.id]);

  const monthlyProgressPercent = Math.round(monthlyResponse?.progress || 0);

  const yearlyProgressData = useMemo(() => {
    const base = monthLabels.map((label, index) => ({
      month: label,
      progress: 0,
      total_days: 0,
      present_days: 0,
      month_index: index + 1,
    }));

    if (!yearlyResponse?.data) return base;
    const byMonth = new Map(yearlyResponse.data.map((item) => [item.month, item]));

    return base.map((entry) => {
      const monthData = byMonth.get(entry.month_index);
      if (!monthData) return entry;
      return {
        ...entry,
        progress: Math.round(monthData.progress || 0),
        total_days: monthData.total_days || 0,
        present_days: monthData.present_days || 0,
      };
    });
  }, [yearlyResponse, monthLabels]);

  const averageProgress = useMemo(() => {
    if (!yearlyProgressData.length) return 0;
    const total = yearlyProgressData.reduce((sum, item) => sum + item.progress, 0);
    return Math.round(total / yearlyProgressData.length);
  }, [yearlyProgressData]);

  const monthlyPieData = useMemo(() => {
    if (!monthlyResponse) return [];
    const present = monthlyResponse.present_days || 0;
    const late = monthlyResponse.late_days || 0;
    const absent = monthlyResponse.absent_days || 0;
    const excused = monthlyResponse.excused_days || 0;
    return [
      { name: 'Present', value: present },
      { name: 'Late', value: late },
      { name: 'Absent', value: absent },
      { name: 'Excused', value: excused },
    ].filter((item) => item.value > 0);
  }, [monthlyResponse]);

  const monthLabel = monthLabels[selectedMonth - 1];
  const monthlyTotalDays = monthlyResponse?.total_days || 0;

  const classSubjectsList = useMemo(() => {
    if (Array.isArray(classSubjectsData)) return classSubjectsData;
    return classSubjectsData?.results || [];
  }, [classSubjectsData]);

  const tasksList = useMemo(() => {
    if (Array.isArray(tasksData)) return tasksData;
    return tasksData?.results || [];
  }, [tasksData]);

  const examsList = useMemo(() => {
    if (Array.isArray(examsData)) return examsData;
    return examsData?.results || [];
  }, [examsData]);

  const today = new Date();

  const coursesEnrolled = classSubjectsList.length;
  const assignmentsDue = tasksList.filter((t) => t.due_date && new Date(t.due_date) >= today).length;
  const subjectIds = new Set(classSubjectsList.map((cs) => cs.subject));
  const upcomingExams = examsList.filter((e) => e.exam_date && new Date(e.exam_date) >= today && (subjectIds.size === 0 || subjectIds.has(e.subject))).length;
  const booksBorrowed = libraryStats?.my_borrowed ?? activeIssues.length;

  const cards = [
    { icon: <MenuBook />, label: 'Courses Enrolled', value: coursesEnrolled || 0, color: 'primary', to: '/student/results' },
    { icon: <AssignmentTurnedIn />, label: 'Assignments Due', value: assignmentsDue || 0, color: 'warning', to: '/student/tasks' },
    { icon: <LibraryBooks />, label: 'Books Borrowed', value: booksBorrowed || 0, color: 'success', to: '/student/library' },
    { icon: <EventAvailable />, label: 'Upcoming Exams', value: upcomingExams || 0, color: 'info', to: '/student/results' },
  ];
  const highlightLabels = new Set(['Courses Enrolled', 'Assignments Due', 'Books Borrowed']);
  const highlightCards = cards.filter((card) => highlightLabels.has(card.label));
  const otherCards = cards.filter((card) => !highlightLabels.has(card.label));

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'left', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'left', gap: 2 }}>
          <Avatar sx={{ width: 56, height: 56 }}>
            {user?.first_name?.[0] || user?.username?.[0] || 'S'}
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Welcome back, {user?.first_name || user?.username || 'Student'}!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {studentProfile?.student_id || '—'} • {studentProfile?.current_class || '—'} {studentProfile?.current_section || ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
            {cgpaValue || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Current GPA
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
        {highlightCards.map((card) => (
          <Box key={card.label} sx={{ minWidth: 260, flex: '0 0 auto' }}>
            <StatCard {...card} />
          </Box>
        ))}
      </Box>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {otherCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <StatCard {...card} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Box>
                <Typography variant="h6">Yearly Progress ({currentYear})</Typography>
                <Typography variant="body2" color="text.secondary">
                  Monthly attendance trend
                </Typography>
              </Box>
              <Typography variant="h6" color="primary">
                Avg: {averageProgress}%
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {yearlyError ? (
              <Typography color="error" sx={{ py: 2 }}>
                Failed to load yearly progress.
              </Typography>
            ) : isYearlyLoading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={30} />
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyProgressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <RechartsTooltip
                      formatter={(value) => [`${value}%`, 'Progress']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line type="monotone" dataKey="progress" stroke="#1976d2" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1, gap: 2 }}>
              <Box>
                <Typography variant="h6">Monthly Progress</Typography>
                <Typography variant="body2" color="text.secondary">
                  {monthLabel} {currentYear} - {monthlyTotalDays} days
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={2}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="month-select-label">Month</InputLabel>
                  <Select
                    labelId="month-select-label"
                    value={selectedMonth}
                    label="Month"
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  >
                    {monthLabels.map((label, index) => (
                      <MenuItem key={label} value={index + 1}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="h6" color="primary">
                  {monthlyProgressPercent}%
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {monthlyError ? (
              <Typography color="error" sx={{ py: 2 }}>
                Failed to load monthly progress.
              </Typography>
            ) : isMonthlyLoading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={30} />
              </Box>
            ) : monthlyPieData.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No attendance data for this month.
              </Typography>
            ) : (
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={monthlyPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {monthlyPieData.map((entry, index) => {
                        const colors = ['#2e7d32', '#ffb300', '#d32f2f', '#6d4c41'];
                        return <Cell key={`cell-${entry.name}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} />
                    <RechartsTooltip formatter={(value, name) => [`${value}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Recent Notices</Typography>
              <Button size="small" component={RouterLink} to="/student/notes">View all</Button>
            </Box>
            <Divider sx={{ mb: 1 }} />
            {isLoading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={30} />
              </Box>
            ) : (notices && notices.length > 0) ? (
              <List>
                {notices.map((notice) => (
                  <ListItem key={notice.id}>
                    <ListItemText
                      primary={notice.title}
                      secondary={`${notice.priority} • ${new Date(notice.published_at).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <List>
                <ListItem>
                  <ListItemText primary="No notices yet." secondary="Check back soon." />
                </ListItem>
              </List>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <Campaign color="primary" />
              <Typography variant="h6">Quick Links</Typography>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Link component={RouterLink} to="/student/report-card" underline="hover">Report Card</Link>
              <Link component={RouterLink} to="/student/attendance" underline="hover">Attendance</Link>
              <Link component={RouterLink} to="/student/library" underline="hover">Library</Link>
              <Link component={RouterLink} to="/student/admission" underline="hover">Admission</Link>
              <Link component={RouterLink} to="/student/results" underline="hover">Results</Link>
              <Link component={RouterLink} to="/student/notes" underline="hover">Notes</Link>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <CalendarWidget title="Academic Calendar" eventsUrl="/events/academic/" />
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudentHome;

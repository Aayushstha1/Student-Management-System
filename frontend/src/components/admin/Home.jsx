import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Assessment as AssessmentIcon,
  AutoGraph as GraphIcon,
  Campaign as NoticeIcon,
  Checklist as ChecklistIcon,
  EventAvailable as ExamIcon,
  EventSeat as SeatIcon,
  Favorite as HealthIcon,
  MeetingRoom as RoomIcon,
  NotificationsActive as AlertIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Rule as PlannerIcon,
  School as SchoolIcon,
  TaskAlt as ReadyIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import CalendarWidget from '../CalendarWidget';

const OverviewStatCard = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="text.secondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: color, width: 52, height: 52 }}>{icon}</Avatar>
      </Box>
    </CardContent>
  </Card>
);

const CommandMetricCard = ({ title, value, subtitle, icon, color = 'primary.main' }) => (
  <Paper sx={{ p: 2.25, height: '100%', borderRadius: 3 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Box>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      </Box>
      <Avatar sx={{ bgcolor: color, width: 50, height: 50 }}>{icon}</Avatar>
    </Stack>
  </Paper>
);

const formatDisplayDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
};

const formatTime = (timeString) => {
  if (!timeString) return 'Time TBD';
  return timeString.slice(0, 5);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatPercent = (value, fallback = 'No data') => {
  if (value === null || value === undefined) return fallback;
  return `${value}%`;
};

const getAttendanceStatusMeta = (status) => {
  switch (status) {
    case 'complete':
      return { label: 'Attendance Complete', color: 'success' };
    case 'in_progress':
      return { label: 'Attendance In Progress', color: 'warning' };
    case 'session_ready':
      return { label: 'Session Ready', color: 'info' };
    default:
      return { label: 'Session Missing', color: 'default' };
  }
};

const getRiskMeta = (band) => {
  switch (band) {
    case 'high':
      return { label: 'High Risk', color: 'error' };
    case 'medium':
      return { label: 'Medium Risk', color: 'warning' };
    default:
      return { label: 'Low Risk', color: 'success' };
  }
};

const getReadinessMeta = (status) => {
  switch (status) {
    case 'ready':
      return { label: 'Ready', color: 'success' };
    case 'almost_ready':
      return { label: 'Almost Ready', color: 'warning' };
    default:
      return { label: 'Needs Attention', color: 'error' };
  }
};

const getHealthMeta = (status) => {
  switch (status) {
    case 'strong':
      return { label: 'Strong', color: 'success' };
    case 'stable':
      return { label: 'Stable', color: 'info' };
    case 'watch':
      return { label: 'Watch', color: 'warning' };
    default:
      return { label: 'Critical', color: 'error' };
  }
};

const Home = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    error: overviewError,
  } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => (await axios.get('/accounts/admin-overview/')).data,
  });

  const {
    data: commandCenterData,
    isLoading: isCommandLoading,
    isError: isCommandError,
    error: commandError,
    isFetching: isCommandFetching,
  } = useQuery({
    queryKey: ['exam-day-command-center', selectedDate],
    queryFn: async () => (
      await axios.get('/accounts/exam-day-command-center/', { params: { date: selectedDate } })
    ).data,
  });

  const {
    data: intelligenceData,
    isLoading: isIntelligenceLoading,
    isError: isIntelligenceError,
    error: intelligenceError,
  } = useQuery({
    queryKey: ['admin-intelligence'],
    queryFn: async () => (await axios.get('/accounts/admin-intelligence/')).data,
  });

  const stats = overviewData?.stats || {
    total_students: 0,
    total_teachers: 0,
    total_users: 0,
    active_students: 0,
    active_teachers: 0,
  };
  const recentActivities = overviewData?.recent_activity || [];
  const commandMetrics = commandCenterData?.metrics || {
    total_exams: 0,
    expected_students: 0,
    assigned_seats: 0,
    seat_completion_percent: 0,
    rooms_in_use: 0,
    attendance_sessions_ready: 0,
    attendance_complete: 0,
    invigilator_slots: 0,
    suggested_invigilators: 0,
  };
  const commandExams = commandCenterData?.exams || [];
  const roomUsage = commandCenterData?.rooms || [];
  const invigilators = commandCenterData?.invigilators || [];
  const alerts = commandCenterData?.alerts || [];

  const student360Rows = intelligenceData?.student_360?.students || [];
  const interventionPlans = intelligenceData?.intervention_planner?.plans || [];
  const examReadinessRows = intelligenceData?.exam_readiness?.exams || [];
  const homeworkAnalyzerRows = intelligenceData?.homework_result_analyzer?.classes || [];
  const academicHealthRows = intelligenceData?.academic_health?.classes || [];

  const roomUsageSorted = useMemo(
    () => [...roomUsage].sort((left, right) => right.assigned_students - left.assigned_students),
    [roomUsage],
  );

  if (isOverviewLoading || isCommandLoading || isIntelligenceLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isOverviewError || isCommandError || isIntelligenceError) {
    return (
      <Alert severity="error">
        {overviewError?.response?.data?.detail ||
          commandError?.response?.data?.detail ||
          intelligenceError?.response?.data?.detail ||
          'Failed to load dashboard data. Please try again.'}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Admin Intelligence Hub
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Exam operations, student 360 timelines, interventions, readiness scoring, homework trends, and class health in one dashboard.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button component={RouterLink} to="/admin/exam-routine" variant="contained" startIcon={<SeatIcon />}>
            Seat Planner
          </Button>
          <Button component={RouterLink} to="/admin/attendance" variant="outlined" startIcon={<ChecklistIcon />}>
            Attendance
          </Button>
          <Button component={RouterLink} to="/admin/results" variant="outlined" startIcon={<AssessmentIcon />}>
            Results
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <OverviewStatCard
            title="Total Students"
            value={stats.total_students}
            icon={<SchoolIcon />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <OverviewStatCard
            title="Total Teachers"
            value={stats.total_teachers}
            icon={<PersonIcon />}
            color="secondary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <OverviewStatCard
            title="Active Students"
            value={stats.active_students}
            icon={<TrendingUpIcon />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={2.4}>
          <OverviewStatCard
            title="Active Teachers"
            value={stats.active_teachers}
            icon={<PeopleIcon />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={2.4}>
          <OverviewStatCard
            title="Total Users"
            value={stats.total_users}
            icon={<PeopleIcon />}
            color="warning.main"
          />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
            {isCommandFetching && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={2}
              sx={{ mb: 3 }}
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Exam Day Command Center
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {commandExams.length > 0
                    ? `${commandExams.length} exam${commandExams.length === 1 ? '' : 's'} scheduled for ${formatDisplayDate(commandCenterData?.selected_date)}`
                    : `No exams scheduled for ${formatDisplayDate(commandCenterData?.selected_date)}`}
                </Typography>
              </Box>
              <TextField
                label="Command Center Date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: { xs: '100%', sm: 220 } }}
              />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} lg={3}>
                <CommandMetricCard
                  title="Exams Scheduled"
                  value={commandMetrics.total_exams}
                  subtitle={`${commandMetrics.expected_students} total student seats expected`}
                  icon={<ExamIcon />}
                  color="primary.main"
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <CommandMetricCard
                  title="Seat Planning"
                  value={`${commandMetrics.seat_completion_percent}%`}
                  subtitle={`${commandMetrics.assigned_seats}/${commandMetrics.expected_students} seats assigned`}
                  icon={<SeatIcon />}
                  color="success.main"
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <CommandMetricCard
                  title="Room Utilization"
                  value={commandMetrics.rooms_in_use}
                  subtitle={`${commandMetrics.invigilator_slots} invigilator slots across active rooms`}
                  icon={<RoomIcon />}
                  color="warning.main"
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <CommandMetricCard
                  title="Attendance Readiness"
                  value={commandMetrics.attendance_sessions_ready}
                  subtitle={`${commandMetrics.attendance_complete} fully marked exam groups`}
                  icon={<ReadyIcon />}
                  color="info.main"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Exam Operations</Typography>
              <Button component={RouterLink} to="/admin/exam-routine" size="small">
                Manage Exams
              </Button>
            </Stack>

            {commandExams.length === 0 ? (
              <Alert severity="info">
                No exams are scheduled for this date. Choose another date or add exams from the exam routine page.
              </Alert>
            ) : (
              <Stack spacing={2}>
                {commandExams.map((exam) => {
                  const attendanceMeta = getAttendanceStatusMeta(exam.attendance?.status);
                  return (
                    <Paper
                      key={exam.id}
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 3, borderColor: 'divider' }}
                    >
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        spacing={2}
                        sx={{ mb: 1.5 }}
                      >
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {exam.subject_name || exam.name}
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            <Chip
                              size="small"
                              label={`Class ${exam.class_name}${exam.section ? ` ${exam.section}` : ''}`}
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              icon={<TimeIcon />}
                              label={`${formatTime(exam.start_time)} - ${formatTime(exam.end_time)}`}
                              variant="outlined"
                            />
                            <Chip size="small" color={attendanceMeta.color} label={attendanceMeta.label} />
                          </Stack>
                        </Box>
                        <Box sx={{ minWidth: { md: 220 } }}>
                          <Typography variant="body2" color="text.secondary">
                            Lead Teacher
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {exam.lead_teacher?.name || 'Not assigned'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {exam.lead_teacher?.employee_id || 'No subject teacher mapping'}
                          </Typography>
                        </Box>
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                            Seat Plan
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {exam.assigned_seats}/{exam.expected_students} students assigned
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(exam.seat_completion_percent || 0, 100)}
                            sx={{ mt: 1, height: 8, borderRadius: 999 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                            Attendance Coverage
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {exam.attendance?.marked_students || 0}/{exam.attendance?.expected_students || 0} students marked
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(exam.attendance?.coverage_percent || 0, 100)}
                            color={
                              exam.attendance?.status === 'complete'
                                ? 'success'
                                : exam.attendance?.status === 'in_progress'
                                ? 'warning'
                                : 'info'
                            }
                            sx={{ mt: 1, height: 8, borderRadius: 999 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                            Room Coverage
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {exam.room_count} room{exam.room_count === 1 ? '' : 's'} active
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {exam.rooms.length > 0
                              ? exam.rooms.map((room) => room.room_name).join(', ')
                              : 'Seat plan not generated yet'}
                          </Typography>
                        </Grid>
                      </Grid>

                      {exam.rooms.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                          {exam.rooms.map((room) => (
                            <Chip
                              key={`${exam.id}-${room.room_id}`}
                              size="small"
                              label={`${room.room_name} | ${room.assigned_students}/${room.capacity} | ${room.suggested_invigilator?.name || 'No invigilator'}`}
                            />
                          ))}
                        </Stack>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3} sx={{ height: '100%' }}>
            <Paper sx={{ p: 3, borderRadius: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Action Queue</Typography>
                <Button component={RouterLink} to="/admin/attendance" size="small">
                  Open
                </Button>
              </Stack>
              {alerts.length === 0 ? (
                <Alert severity="success">No blockers detected for this exam day.</Alert>
              ) : (
                <List disablePadding>
                  {alerts.map((alert, index) => (
                    <ListItem key={`${alert.type}-${index}`} disablePadding sx={{ mb: index === alerts.length - 1 ? 0 : 1 }}>
                      <ListItemButton component={RouterLink} to={alert.link || '/admin/exam-routine'} sx={{ borderRadius: 2 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: alert.severity === 'warning' ? 'warning.light' : 'info.light', color: 'text.primary' }}>
                            <AlertIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={alert.message}
                          secondary={alert.type === 'seat_plan' ? 'Seat plan alert' : 'Attendance alert'}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>

            <Paper sx={{ p: 3, borderRadius: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quick Actions
              </Typography>
              <List disablePadding>
                {[
                  { to: '/admin/exam-routine', label: 'Update Seat Plans', secondary: 'Generate or refine exam seating' },
                  { to: '/admin/attendance', label: 'Create Attendance Sessions', secondary: 'Open exam-day attendance coverage' },
                  { to: '/admin/results', label: 'Review Results Queue', secondary: 'Check result approvals and exam records' },
                  { to: '/admin/notices', label: 'Publish Exam Notice', secondary: 'Notify classes, parents, or staff' },
                ].map((item, index) => (
                  <ListItem key={item.to} disablePadding sx={{ mb: index === 3 ? 0 : 1 }}>
                    <ListItemButton component={RouterLink} to={item.to} sx={{ borderRadius: 2 }}>
                      <ListItemText primary={item.label} secondary={item.secondary} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Room List</Typography>
              <Typography variant="body2" color="text.secondary">
                {roomUsageSorted.length} room{roomUsageSorted.length === 1 ? '' : 's'} in use
              </Typography>
            </Stack>

            {roomUsageSorted.length === 0 ? (
              <Alert severity="info">Room usage will appear here after seat plans are generated.</Alert>
            ) : (
              <Grid container spacing={2}>
                {roomUsageSorted.map((room) => (
                  <Grid item xs={12} md={6} key={room.room_id}>
                    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {room.room_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {room.building || 'Main Block'} | {room.rows} x {room.columns} grid
                          </Typography>
                        </Box>
                        <Chip size="small" label={`${room.assigned_students}/${room.capacity}`} color="primary" />
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(room.occupancy_percent || 0, 100)}
                        sx={{ mt: 2, mb: 1.5, height: 8, borderRadius: 999 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Peak load: {room.assigned_students}/{room.capacity} seats. Daily total: {room.daily_total_students} seat assignments.
                      </Typography>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack spacing={1}>
                        {room.exams.slice(0, 3).map((exam) => (
                          <Box key={`${room.room_id}-${exam.exam_id}`}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {exam.subject_name || exam.exam_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Class {exam.class_name}
                              {exam.section ? ` ${exam.section}` : ''} | {formatTime(exam.start_time)} - {formatTime(exam.end_time)} | {exam.assigned_students} students
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Invigilator View</Typography>
              <Typography variant="body2" color="text.secondary">
                {commandMetrics.suggested_invigilators} suggestions
              </Typography>
            </Stack>

            {invigilators.length === 0 ? (
              <Alert severity="info">Generate seat plans to see room-by-room invigilator suggestions.</Alert>
            ) : (
              <List disablePadding>
                {invigilators.map((entry, index) => (
                  <ListItem
                    key={`${entry.exam_id}-${entry.room_id}-${entry.teacher?.id || index}`}
                    disablePadding
                    sx={{ mb: index === invigilators.length - 1 ? 0 : 1 }}
                  >
                    <ListItemButton component={RouterLink} to="/admin/exam-routine" sx={{ borderRadius: 2 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.light', color: 'text.primary' }}>
                          <PersonIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={entry.teacher?.name || 'No invigilator suggested'}
                        secondary={`${entry.room_name} | ${entry.subject_name} | Class ${entry.class_name}${entry.section ? ` ${entry.section}` : ''} | ${formatTime(entry.start_time)} - ${formatTime(entry.end_time)}`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">
                <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Student 360 Timeline
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {student360Rows.length} spotlight student{student360Rows.length === 1 ? '' : 's'}
              </Typography>
            </Stack>

            {student360Rows.length === 0 ? (
              <Alert severity="info">Student timelines will appear here as data is collected.</Alert>
            ) : (
              <Stack spacing={2}>
                {student360Rows.map((entry) => {
                  const riskMeta = getRiskMeta(entry.risk_band);
                  return (
                    <Paper key={entry.student.id} variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        spacing={2}
                        sx={{ mb: 1.5 }}
                      >
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {entry.student.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Class {entry.student.class_name}
                            {entry.student.section ? ` ${entry.student.section}` : ''} | Roll {entry.student.roll_number || '-'} | Student ID {entry.student.student_id}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip color={riskMeta.color} label={`${riskMeta.label} (${entry.risk_score})`} />
                          <Chip variant="outlined" label={`Attendance ${formatPercent(entry.attendance_percent)}`} />
                          <Chip variant="outlined" label={`Results ${formatPercent(entry.avg_result_percent)}`} />
                          <Chip variant="outlined" label={`Homework ${formatPercent(entry.task_submission_rate)}`} />
                        </Stack>
                      </Stack>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                        <Chip size="small" label={`Task score ${formatPercent(entry.avg_task_percent)}`} />
                        <Chip size="small" label={`Notice read ${formatPercent(entry.notice_read_percent)}`} />
                        <Chip size="small" label={`${entry.overdue_missing_tasks} overdue task(s)`} />
                        <Chip size="small" label={`${entry.pending_items} pending support item(s)`} />
                      </Stack>

                      <List disablePadding>
                        {entry.timeline.map((item, index) => (
                          <ListItem key={`${entry.student.id}-${item.type}-${index}`} disablePadding sx={{ mb: index === entry.timeline.length - 1 ? 0 : 1 }}>
                            <ListItemButton sx={{ borderRadius: 2 }}>
                              <ListItemText
                                primary={item.title}
                                secondary={`${item.description} | ${formatDateTime(item.time)}`}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">
                <PlannerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Intervention Planner
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {intelligenceData?.intervention_planner?.high_priority_count || 0} immediate plan(s)
              </Typography>
            </Stack>

            {interventionPlans.length === 0 ? (
              <Alert severity="success">No intervention plans are needed right now.</Alert>
            ) : (
              <Stack spacing={2}>
                {interventionPlans.map((plan) => {
                  const riskMeta = getRiskMeta(plan.risk_band);
                  return (
                    <Paper key={plan.student.id} variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {plan.student.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Class {plan.student.class_name}
                            {plan.student.section ? ` ${plan.student.section}` : ''} | Owner: {plan.owner}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Chip color={riskMeta.color} label={`${riskMeta.label} (${plan.risk_score})`} />
                          <Chip variant="outlined" label={plan.priority} />
                        </Stack>
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                        Why this student is on the planner
                      </Typography>
                      <List disablePadding sx={{ mb: 1.25 }}>
                        {plan.reasons.map((reason, index) => (
                          <ListItem key={`${plan.student.id}-reason-${index}`} disablePadding>
                            <ListItemText primary={reason} />
                          </ListItem>
                        ))}
                      </List>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                        Suggested actions
                      </Typography>
                      <List disablePadding>
                        {plan.actions.map((action, index) => (
                          <ListItem key={`${plan.student.id}-action-${index}`} disablePadding>
                            <ListItemText primary={action} />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">
                <ReadyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Exam Readiness Score
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average score {formatPercent(intelligenceData?.exam_readiness?.summary?.average_score, '0%')}
              </Typography>
            </Stack>

            {examReadinessRows.length === 0 ? (
              <Alert severity="info">Upcoming exam readiness will appear here once active exams are scheduled.</Alert>
            ) : (
              <Grid container spacing={2}>
                {examReadinessRows.map((exam) => {
                  const readinessMeta = getReadinessMeta(exam.status);
                  return (
                    <Grid item xs={12} md={6} lg={3} key={exam.id}>
                      <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {exam.subject_name || exam.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatDisplayDate(exam.exam_date)} | Class {exam.class_name}
                              {exam.section ? ` ${exam.section}` : ''}
                            </Typography>
                          </Box>
                          <Chip size="small" color={readinessMeta.color} label={readinessMeta.label} />
                        </Stack>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 2 }}>
                          {exam.readiness_score}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(exam.readiness_score || 0, 100)}
                          color={readinessMeta.color}
                          sx={{ mt: 1.25, mb: 1.5, height: 8, borderRadius: 999 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Seats {exam.assigned_seats}/{exam.expected_students} | Rooms {exam.room_count}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Lead teacher: {exam.lead_teacher_name || 'Not assigned'}
                        </Typography>
                        {exam.flags.length > 0 && (
                          <List disablePadding sx={{ mt: 1 }}>
                            {exam.flags.slice(0, 2).map((flag, index) => (
                              <ListItem key={`${exam.id}-flag-${index}`} disablePadding>
                                <ListItemText primary={flag} primaryTypographyProps={{ variant: 'caption' }} />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">
                <GraphIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Homework vs Result Analyzer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Class-by-class alignment
              </Typography>
            </Stack>

            {homeworkAnalyzerRows.length === 0 ? (
              <Alert severity="info">Homework and result comparisons will appear after tasks and approved results exist.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Class</TableCell>
                    <TableCell align="right">Homework</TableCell>
                    <TableCell align="right">Task Score</TableCell>
                    <TableCell align="right">Result Avg</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {homeworkAnalyzerRows.map((row) => (
                    <TableRow key={`${row.class_name}-${row.section || 'none'}`}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.student_count} students | {row.overdue_missing_tasks} overdue gaps
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatPercent(row.task_submission_rate)}</TableCell>
                      <TableCell align="right">{formatPercent(row.avg_task_percent)}</TableCell>
                      <TableCell align="right">{formatPercent(row.avg_result_percent)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {homeworkAnalyzerRows.length > 0 && (
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                {homeworkAnalyzerRows.map((row) => (
                  <Paper key={`${row.label}-status`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.alignment_status}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">
                <HealthIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Academic Health Score by Class
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average score {formatPercent(intelligenceData?.academic_health?.average_score, '0%')}
              </Typography>
            </Stack>

            {academicHealthRows.length === 0 ? (
              <Alert severity="info">Class health scores will appear once attendance, results, and tasks have data.</Alert>
            ) : (
              <Grid container spacing={2}>
                {academicHealthRows.map((row) => {
                  const healthMeta = getHealthMeta(row.status);
                  return (
                    <Grid item xs={12} md={6} key={`${row.class_name}-${row.section || 'none'}`}>
                      <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {row.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {row.student_count} students | {row.high_risk_students} at-risk student(s)
                            </Typography>
                          </Box>
                          <Chip size="small" color={healthMeta.color} label={healthMeta.label} />
                        </Stack>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 2 }}>
                          {row.health_score}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(row.health_score || 0, 100)}
                          color={healthMeta.color}
                          sx={{ mt: 1.25, mb: 1.5, height: 8, borderRadius: 999 }}
                        />
                        <Stack spacing={1}>
                          <Typography variant="body2" color="text.secondary">
                            Attendance {formatPercent(row.attendance_score)} | Results {formatPercent(row.result_score)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Homework {formatPercent(row.homework_score)} | Engagement {formatPercent(row.engagement_score)}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Recent Activities</Typography>
              <Typography variant="body2" color="text.secondary">
                Updated {formatDateTime(overviewData?.generated_at)}
              </Typography>
            </Stack>

            {recentActivities.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No recent activities to display yet.
              </Typography>
            ) : (
              <List disablePadding>
                {recentActivities.map((activity, index) => (
                  <ListItem key={`${activity.type}-${index}`} disablePadding sx={{ mb: index === recentActivities.length - 1 ? 0 : 1 }}>
                    <ListItemButton component={RouterLink} to={activity.link || '/admin'} sx={{ borderRadius: 2 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.light', color: 'text.primary' }}>
                          {activity.type === 'notice' ? <NoticeIcon fontSize="small" /> : <AssessmentIcon fontSize="small" />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={activity.title} secondary={`${activity.subtitle} | ${formatDateTime(activity.time)}`} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <CalendarWidget canCreate title="Events Calendar" />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Home;

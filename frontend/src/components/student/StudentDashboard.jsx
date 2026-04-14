import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon as MuiListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  School as SchoolIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  AssignmentTurnedIn as AttendanceIcon,
  LibraryBooks as LibraryIcon,
  Grade as ResultsIcon,
  Note as NotesIcon,
  Badge as AdmissionIcon,
  Campaign as NoticesIcon,
  Assignment as TasksIcon,
  Notifications as NotificationsIcon,
  Description as DescriptionIcon,
  PhotoLibrary as PhotoLibraryIcon,
  EventNote as LeaveIcon,
  Schedule as TimetableIcon,
  EventAvailable as ExamRoutineIcon,
  Star as StarIcon,
  History as HistoryIcon,
  Home as HostelIcon,
  FindInPage as LostFoundIcon,
  FactCheck as ConsentIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import StudentHome from './Dashboard';
import AdmissionRecords from './AdmissionRecords';
import Library from './Library';
import Attendance from './Attendance';
import Results from './Results';
import Notes from './Notes';
import TeacherRatings from './TeacherRatings';
import BorrowHistory from './BorrowHistory';
import Notices from './Notices';
import NotificationsList from './NotificationsList';
import Profile from './Profile';
import Tasks from './Tasks';
import MyCVs from './MyCVs';
import EventGallery from '../gallery/EventGallery';
import LeaveLetters from './LeaveLetters';
import Timetable from './Timetable';
import Hostel from './Hostel';
import ExamRoutine from './ExamRoutine';
import LostAndFound from '../LostAndFound';
import Consents from './Consents';
import { Badge } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const drawerWidth = 220;

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { data: unreadData } = useQuery({
    queryKey: ['user-notifications-unread-count'],
    queryFn: async () => {
      const resp = await axios.get('notices/notifications/unread-count/');
      return resp.data;
    },
    refetchInterval: 30000,
  });

  const unread = unreadData?.unread || 0;

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/student' },
    { text: 'Profile', icon: <AccountIcon />, path: '/student/profile' },
    { text: 'Tasks', icon: <TasksIcon />, path: '/student/tasks' },
    { text: 'Admission', icon: <AdmissionIcon />, path: '/student/admission' },
    { text: 'Notices', icon: <NoticesIcon />, path: '/student/notices' },
    { text: 'Notifications', icon: <Badge badgeContent={unread} color="error"><NotificationsIcon /></Badge>, path: '/student/notifications' },
    { text: 'Library', icon: <LibraryIcon />, path: '/student/library' },
    { text: 'Borrowing History', icon: <HistoryIcon />, path: '/student/borrow-history' },
    { text: 'Hostel', icon: <HostelIcon />, path: '/student/hostel' },
    { text: 'Attendance', icon: <AttendanceIcon />, path: '/student/attendance' },
    { text: 'Timetable', icon: <TimetableIcon />, path: '/student/timetable' },
    { text: 'Exam Routine', icon: <ExamRoutineIcon />, path: '/student/exam-routine' },
    { text: 'Consent Forms', icon: <ConsentIcon />, path: '/student/consents' },
    { text: 'Lost & Found', icon: <LostFoundIcon />, path: '/student/lost-found' },
    { text: 'Leave Letters', icon: <LeaveIcon />, path: '/student/leaves' },
    { text: 'Results', icon: <ResultsIcon />, path: '/student/results' },
    { text: 'Notes', icon: <NotesIcon />, path: '/student/notes' },
    { text: 'Rate Teachers', icon: <StarIcon />, path: '/student/teacher-ratings' },
    { text: 'CVs', icon: <DescriptionIcon />, path: '/student/cvs' },
    { text: 'Gallery', icon: <PhotoLibraryIcon />, path: '/student/gallery' },
  ];

  const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleProfileMenuClose = () => setAnchorEl(null);
  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/', { replace: true });
  };
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const drawer = (
    <Box sx={{ height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mx: 'auto' }}>
          Student
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  color: active ? 'primary.main' : 'text.primary',
                  backgroundColor: active ? 'action.selected' : 'transparent',
                }}
              >
                <MuiListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                  {item.icon}
                </MuiListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={3}
        sx={{
          background: 'linear-gradient(90deg, #1e3c72, #2a5298)',
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <SchoolIcon />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Student Portal
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.first_name?.[0] || user?.username?.[0] || 'S'}
            </Avatar>
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            keepMounted
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={handleProfileMenuClose}>
              <ListItemIcon>
                <AccountIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: '#f4f6f8',
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Routes>
          <Route index element={<StudentHome />} />
          <Route path="profile" element={<Profile />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="cvs" element={<MyCVs />} />
          <Route path="admission" element={<AdmissionRecords />} />
          <Route path="notices" element={<Notices />} />
          <Route path="notifications" element={<NotificationsList />} />
          <Route path="library" element={<Library />} />
          <Route path="borrow-history" element={<BorrowHistory />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="exam-routine" element={<ExamRoutine />} />
          <Route path="consents" element={<Consents />} />
          <Route path="lost-found" element={<LostAndFound title="Lost & Found" />} />
          <Route path="leaves" element={<LeaveLetters />} />
          <Route path="hostel" element={<Hostel />} />
          <Route path="results" element={<Results />} />
          <Route path="notes" element={<Notes />} />
          <Route path="teacher-ratings" element={<TeacherRatings />} />
          <Route path="gallery" element={<EventGallery />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default StudentDashboard;



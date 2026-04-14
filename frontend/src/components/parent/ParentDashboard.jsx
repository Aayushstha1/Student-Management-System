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
} from '@mui/material';
import {
  School as SchoolIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  AssignmentTurnedIn as AttendanceIcon,
  Grade as ResultsIcon,
  Event as CalendarIcon,
  Schedule as TimetableIcon,
  EventAvailable as ExamRoutineIcon,
  Campaign as NoticesIcon,
  FactCheck as ConsentIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ParentHome from './Dashboard';
import ParentAttendance from './Attendance';
import ParentResults from './Results';
import ParentCalendar from './Calendar';
import ParentTimetable from './Timetable';
import ParentNotices from './Notices';
import ExamRoutine from './ExamRoutine';
import ParentConsents from './Consents';

const drawerWidth = 220;

const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/parent' },
    { text: 'Timetable', icon: <TimetableIcon />, path: '/parent/timetable' },
    { text: 'Exam Routine', icon: <ExamRoutineIcon />, path: '/parent/exam-routine' },
    { text: 'Attendance', icon: <AttendanceIcon />, path: '/parent/attendance' },
    { text: 'Results', icon: <ResultsIcon />, path: '/parent/results' },
    { text: 'Calendar', icon: <CalendarIcon />, path: '/parent/calendar' },
    { text: 'Consent Forms', icon: <ConsentIcon />, path: '/parent/consents' },
    { text: 'Notices', icon: <NoticesIcon />, path: '/parent/notices' },
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
          Parent
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
          background: 'linear-gradient(90deg, #0f2027, #203a43, #2c5364)',
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
            Parent Portal
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.first_name || user?.username}
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
              {user?.first_name?.[0] || user?.username?.[0] || 'P'}
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
          <Route index element={<ParentHome />} />
          <Route path="timetable" element={<ParentTimetable />} />
          <Route path="exam-routine" element={<ExamRoutine />} />
          <Route path="attendance" element={<ParentAttendance />} />
          <Route path="results" element={<ParentResults />} />
          <Route path="calendar" element={<ParentCalendar />} />
          <Route path="consents" element={<ParentConsents />} />
          <Route path="notices" element={<ParentNotices />} />
          <Route path="*" element={<Navigate to="/parent" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default ParentDashboard;

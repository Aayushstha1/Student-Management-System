import React, { useState } from "react";
import { Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
  Tooltip,
  Badge,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon,
  Home as HomeIcon,
  LibraryBooks as LibraryIcon,
  Grade as GradeIcon,
  MenuBook as SubjectsIcon,
  Announcement as NoticeIcon,
  Note as NoteIcon,
  Menu as MenuIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Assignment as TasksIcon,
  Description as DescriptionIcon,
  PhotoLibrary as PhotoLibraryIcon,
  EventNote as LeaveIcon,
  EventAvailable as ExamIcon,
  Star as StarIcon,
  Schedule as TimetableIcon,
  LockReset as PasswordResetIcon,
  Email as EmailIcon,
  Badge as StaffIcon,
  BadgeOutlined as IdCardIcon,
  Notifications as NotificationsIcon,
  FindInPage as LostFoundIcon,
  FactCheck as ConsentIcon,
} from "@mui/icons-material";
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";
import Home from "./Home";
import UserManagement from "./UserManagement";
import StaffManagement from "./StaffManagement";
import StudentManagement from "./StudentManagement";
import TeacherManagement from "./TeacherManagement";
import AttendanceManagement from "./AttendanceManagement";
import HostelManagement from "./HostelManagement";
import LibraryManagement from "./LibraryManagement";
import ResultsManagement from "./ResultsManagement";
import ClassSubjectsManagement from "./ClassSubjectsManagement";
import NoticesManagement from "./NoticesManagement";
import NotesManagement from "./NotesManagement";
import Tasks from "./Tasks";
import CVManagement from './CVManagement';
import EventGallery from '../gallery/EventGallery';
import LeaveRequests from '../LeaveRequests';
import TeacherRatings from './TeacherRatings';
import TimetableManagement from './TimetableManagement';
import PasswordResetRequests from './PasswordResetRequests';
import EmailChangeRequests from './EmailChangeRequests';
import AdminNotifications from './Notifications';
import ExamRoutineManagement from './ExamRoutineManagement';
import LostAndFound from '../LostAndFound';
import IdCardGenerator from './IdCardGenerator';
import ConsentManagement from './ConsentManagement';

const drawerWidth = 240;

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
    { text: "Dashboard", icon: <DashboardIcon />, path: "/admin" },
    { text: "User Management", icon: <PeopleIcon />, path: "/admin/users" },
    { text: "Staff", icon: <StaffIcon />, path: "/admin/staff" },
    { text: "Students", icon: <SchoolIcon />, path: "/admin/students" },
    { text: "Consent Forms", icon: <ConsentIcon />, path: "/admin/consents" },
    { text: "ID Cards", icon: <IdCardIcon />, path: "/admin/id-cards" },
    { text: "Password Requests", icon: <PasswordResetIcon />, path: "/admin/password-requests" },
    { text: "Email Requests", icon: <EmailIcon />, path: "/admin/email-change-requests" },
    { text: "Teachers", icon: <PersonIcon />, path: "/admin/teachers" },
    { text: "Tasks", icon: <TasksIcon />, path: "/admin/tasks" },
    { text: "Attendance", icon: <AssessmentIcon />, path: "/admin/attendance" },
    { text: "Hostel", icon: <HomeIcon />, path: "/admin/hostel" },
    { text: "Library", icon: <LibraryIcon />, path: "/admin/library" },
    { text: "Results", icon: <GradeIcon />, path: "/admin/results" },
    { text: "Exam Routine", icon: <ExamIcon />, path: "/admin/exam-routine" },
    { text: "Lost & Found", icon: <LostFoundIcon />, path: "/admin/lost-found" },
    { text: "Class Subjects", icon: <SubjectsIcon />, path: "/admin/class-subjects" },
    { text: "Timetable", icon: <TimetableIcon />, path: "/admin/timetable" },
    { text: "Notices", icon: <NoticeIcon />, path: "/admin/notices" },
    { text: "Notifications", icon: <Badge badgeContent={unread} color="error"><NotificationsIcon /></Badge>, path: "/admin/notifications" },
    { text: "Notes", icon: <NoteIcon />, path: "/admin/notes" },
    { text: "Teacher Ratings", icon: <StarIcon />, path: "/admin/teacher-ratings" },
    { text: "Leave Requests", icon: <LeaveIcon />, path: "/admin/leaves" },
    { text: "CVs", icon: <DescriptionIcon />, path: "/admin/cvs" },
    { text: "Gallery", icon: <PhotoLibraryIcon />, path: "/admin/gallery" },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate("/", { replace: true });
  };

  const drawer = (
    <Box
      sx={{
        height: "100%",
        background: "linear-gradient(180deg, #1e3c72, #2a5298)",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: "bold", mx: "auto" }}>
          Admin Panel
        </Typography>
      </Toolbar>
      <Divider sx={{ bgcolor: "rgba(255,255,255,0.2)" }} />
      <List sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
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
                  color: active ? "#1e3c72" : "white",
                  backgroundColor: active ? "white" : "transparent",
                  transition: "0.3s",
                  "&:hover": {
                    backgroundColor: active
                      ? "white"
                      : "rgba(255,255,255,0.15)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: active ? "#1e3c72" : "white",
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? "bold" : "normal",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        elevation={4}
        sx={{
          background: "linear-gradient(90deg, #1e3c72, #2a5298)",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            sx={{ flexGrow: 1, fontWeight: "bold", letterSpacing: 0.5 }}
          >
             Student Management System (Admin)
          </Typography>

          <Tooltip title="Profile Menu">
          <span>
            <IconButton onClick={handleProfileMenuOpen} color="inherit">
              <Avatar
                sx={{
                  width: 35,
                  height: 35,
                  bgcolor: "#fff",
                  color: "#1e3c72",
                  fontWeight: "bold",
                }}
              >
                {user?.first_name?.[0] || user?.username?.[0] || "A"}
              </Avatar>
            </IconButton>
          </span>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={handleProfileMenuClose}>
              <ListItemIcon>
                <AccountIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              border: "none",
            },
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
          bgcolor: "#f4f6f8",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          transition: "0.3s ease",
        }}
      >
        <Toolbar />
        <Routes>
          <Route index element={<Home />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="consents" element={<ConsentManagement />} />
          <Route path="id-cards" element={<IdCardGenerator />} />
          <Route path="password-requests" element={<PasswordResetRequests />} />
          <Route path="email-change-requests" element={<EmailChangeRequests />} />
          <Route path="teachers" element={<TeacherManagement />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="attendance" element={<AttendanceManagement />} />
          <Route path="hostel" element={<HostelManagement />} />
          <Route path="library" element={<LibraryManagement />} />
          <Route path="results" element={<ResultsManagement />} />
          <Route path="exam-routine" element={<ExamRoutineManagement />} />
          <Route path="lost-found" element={<LostAndFound title="Lost & Found" />} />
          <Route path="class-subjects" element={<ClassSubjectsManagement />} />
          <Route path="timetable" element={<TimetableManagement />} />
          <Route path="notices" element={<NoticesManagement />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="notes" element={<NotesManagement />} />
          <Route path="teacher-ratings" element={<TeacherRatings />} />
          <Route path="leaves" element={<LeaveRequests title="Leave Requests" />} />
          <Route path="cvs" element={<CVManagement />} />
          <Route path="gallery" element={<EventGallery />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Dashboard;

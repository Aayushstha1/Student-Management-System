import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import AdminDashboard from './components/admin/Dashboard';
import PublicStudentProfile from './components/PublicStudentProfile';
import PublicTeacherProfile from './components/PublicTeacherProfile';
import StudentDashboard from './components/student/StudentDashboard';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import ParentDashboard from './components/parent/ParentDashboard';
import LibraryStaffDashboard from './components/library/LibraryStaffDashboard';
import HostelWardenDashboard from './components/hostel/HostelWardenDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './components/LandingPage';

// Create a client
const queryClient = new QueryClient();

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route 
                path="/admin/*" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              {/* Public profiles accessible via scanned QR links */}
              <Route path="/public/student/:studentId" element={<PublicStudentProfile />} />
              <Route path="/public/teacher/:employeeId" element={<PublicTeacherProfile />} />
              <Route 
                path="/student/*" 
                element={
                  <ProtectedRoute allowedRoles={['student']}>
                    <StudentDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/teacher/*" 
                element={
                  <ProtectedRoute allowedRoles={['teacher']}>
                    <TeacherDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/parent/*" 
                element={
                  <ProtectedRoute allowedRoles={['parent']}>
                    <ParentDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/library/*"
                element={
                  <ProtectedRoute allowedRoles={['librarian']}>
                    <LibraryStaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hostel-warden/*"
                element={
                  <ProtectedRoute allowedRoles={['hostel_warden']}>
                    <HostelWardenDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<LandingPage />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

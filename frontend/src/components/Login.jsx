import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [parentLogin, setParentLogin] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotForm, setForgotForm] = useState({
    username: '',
    class_name: '',
    father_name: '',
    email: '',
  });
  
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect based on user role
      switch (user.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'student':
          navigate('/student');
          break;
        case 'teacher':
          navigate('/teacher');
          break;
        case 'parent':
          navigate('/parent');
          break;
        case 'librarian':
          navigate('/library');
          break;
        case 'hostel_warden':
          navigate('/hostel-warden');
          break;
        default:
          navigate('/login');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.username, formData.password, { parentLogin });
    
    if (result.success) {
      // Navigation will be handled by useEffect
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleForgotChange = (e) => {
    setForgotForm({
      ...forgotForm,
      [e.target.name]: e.target.value,
    });
    setForgotError('');
    setForgotSuccess('');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const resp = await axios.post('/students/password-reset-requests/', forgotForm);
      setForgotSuccess(resp.data?.detail || 'Request submitted. Admin will review it.');
      setForgotForm({ username: '', class_name: '', father_name: '', email: '' });
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SchoolIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography component="h1" variant="h4" gutterBottom>
              Student Management System
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please sign in to your account
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
              <Button
                fullWidth
                variant="text"
                onClick={() => setForgotOpen(true)}
                disabled={loading}
              >
                Forgot password?
              </Button>
            </Box>

           
          </Box>
        </Paper>
      </Box>

      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Forgot Password Request</DialogTitle>
        <form onSubmit={handleForgotSubmit}>
          <DialogContent>
            {forgotError && <Alert severity="error" sx={{ mb: 2 }}>{forgotError}</Alert>}
            {forgotSuccess && <Alert severity="success" sx={{ mb: 2 }}>{forgotSuccess}</Alert>}
            <TextField
              margin="normal"
              fullWidth
              label="Username"
              name="username"
              value={forgotForm.username}
              onChange={handleForgotChange}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Class"
              name="class_name"
              value={forgotForm.class_name}
              onChange={handleForgotChange}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Father Name"
              name="father_name"
              value={forgotForm.father_name}
              onChange={handleForgotChange}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={forgotForm.email}
              onChange={handleForgotChange}
              required
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Your request will be reviewed by admin. If approved, a new password will be emailed to you.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForgotOpen(false)}>Close</Button>
            <Button type="submit" variant="contained" disabled={forgotLoading}>
              {forgotLoading ? <CircularProgress size={22} /> : 'Send Request'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default Login;

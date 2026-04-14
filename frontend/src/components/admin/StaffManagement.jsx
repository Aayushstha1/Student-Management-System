import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const staffRoles = [
  { value: 'librarian', label: 'Librarian' },
  { value: 'hostel_warden', label: 'Hostel Warden' },
];

const StaffManagement = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    role: 'librarian',
    phone: '',
    address: ''
  });
  const [editFormData, setEditFormData] = useState({
    username: '',
    password: '',
    password_confirm: '',
    role: 'librarian',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const formatError = (err) => {
    const data = err?.response?.data;
    if (!data) return 'Request failed.';
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    return Object.entries(data)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join(' | ');
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      let results = [];
      let url = '/accounts/users/';
      while (url) {
        const response = await axios.get(url);
        const data = response.data;
        if (Array.isArray(data)) {
          return data;
        }
        results = results.concat(data?.results || []);
        url = data?.next || null;
      }
      return results;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axios.post('/accounts/users/', userData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setOpenDialog(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        role: 'librarian',
        phone: '',
        address: ''
      });
    },
    onError: (error) => {
      setError(formatError(error));
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData) => {
      const { userId, ...data } = userData;
      const response = await axios.patch(`/accounts/users/${userId}/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setOpenEditDialog(false);
      setSelectedUser(null);
      setEditFormData({
        username: '',
        password: '',
        password_confirm: '',
        role: 'librarian',
      });
    },
    onError: (error) => {
      setError(formatError(error));
    }
  });

  const handleOpenDialog = () => {
    setOpenDialog(true);
    setError('');
    setFormData({
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      first_name: '',
      last_name: '',
      role: 'librarian',
      phone: '',
      address: ''
    });
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setError('');
  };

  const handleOpenEditDialog = (user) => {
    setSelectedUser(user);
    setEditFormData({
      username: user.username,
      password: '',
      password_confirm: '',
      role: user.role,
    });
    setOpenEditDialog(true);
    setError('');
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedUser(null);
    setEditFormData({
      username: '',
      password: '',
      password_confirm: '',
      role: 'librarian',
    });
    setError('');
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleEditInputChange = (e) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.password_confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    createUserMutation.mutate(formData);
    setLoading(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editFormData.password && editFormData.password !== editFormData.password_confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const updateData = {
      userId: selectedUser.id,
      username: editFormData.username,
      role: editFormData.role,
    };
    if (editFormData.password) {
      updateData.password = editFormData.password;
    }
    updateUserMutation.mutate(updateData);
    setLoading(false);
  };

  const usersArray = Array.isArray(users) ? users : (users?.results || []);
  const staffUsers = usersArray.filter((u) => ['librarian', 'hostel_warden'].includes(u.role));
  const librarians = staffUsers.filter((u) => u.role === 'librarian');
  const wardens = staffUsers.filter((u) => u.role === 'hostel_warden');

  const renderStaffTable = (list, emptyLabel) => {
    if (list.length === 0) {
      return <Typography color="text.secondary">{emptyLabel}</Typography>;
    }
    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.first_name} {user.last_name}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone || '-'}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleOpenEditDialog(user)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Staff Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Add Staff
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Librarians ({librarians.length})
        </Typography>
        {renderStaffTable(librarians, 'No librarians found.')}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Hostel Wardens ({wardens.length})
        </Typography>
        {renderStaffTable(wardens, 'No hostel wardens found.')}
      </Paper>

      {/* Create Staff Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Create Staff</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Username" name="username" value={formData.username} onChange={handleInputChange} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="First Name" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Last Name" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Password" name="password" type="password" value={formData.password} onChange={handleInputChange} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Confirm Password" name="password_confirm" type="password" value={formData.password_confirm} onChange={handleInputChange} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select name="role" value={formData.role} onChange={handleInputChange} label="Role">
                    {staffRoles.map((r) => (
                      <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleInputChange} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" name="address" multiline rows={3} value={formData.address} onChange={handleInputChange} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Create Staff'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Staff</DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {selectedUser && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="textSecondary">
                Editing: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
              </Typography>
              <TextField fullWidth label="Username" name="username" value={editFormData.username} onChange={handleEditInputChange} />
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select name="role" value={editFormData.role} onChange={handleEditInputChange} label="Role">
                  {staffRoles.map((r) => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField fullWidth label="New Password" placeholder="Leave blank to keep current password" name="password" type="password" value={editFormData.password} onChange={handleEditInputChange} />
              <TextField fullWidth label="Confirm New Password" placeholder="Leave blank to keep current password" name="password_confirm" type="password" value={editFormData.password_confirm} onChange={handleEditInputChange} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseEditDialog} color="inherit">Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StaffManagement;

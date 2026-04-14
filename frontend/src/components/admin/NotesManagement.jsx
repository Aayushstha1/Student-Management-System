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
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Note as NoteIcon, Add as AddIcon, Delete as DeleteIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

const NotesManagement = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    category: '',
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewsError, setViewsError] = useState('');
  const [viewsList, setViewsList] = useState([]);
  const [selectedNoteForViews, setSelectedNoteForViews] = useState(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#28a745' });

  const queryClient = useQueryClient();

  const { data: notes, isLoading, isError } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const res = await axios.get('/notes/');
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      return list;
    },
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await axios.get('/attendance/subjects/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['note-categories'],
    queryFn: async () => {
      const res = await axios.get('/notes/categories/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ title, subject, category, file }) => {
      const formDataToSend = new FormData();
      formDataToSend.append('title', title);
      if (subject) formDataToSend.append('subject', subject);
      if (category) formDataToSend.append('category', category);
      if (file) {
        formDataToSend.append('attachment', file);
      }
      const res = await axios.post('/notes/', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setOpenDialog(false);
      setFormData({
        title: '',
        subject: '',
        category: '',
      });
      setFile(null);
    },
    onError: (e) => {
      setError(e.response?.data?.message || 'Failed to create note');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, description, color }) => {
      const res = await axios.post('/notes/categories/', { name, description, color });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['note-categories']);
      setCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '', color: '#28a745' });
    },
    onError: (e) => {
      setError(e.response?.data?.detail || 'Failed to create category');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id) => {
      await axios.delete(`/notes/categories/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['note-categories']);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id) => {
      await axios.delete(`/notes/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
    },
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleFileChange = (e) => {
    const selected = e.target.files && e.target.files[0];
    setFile(selected || null);
    setError('');
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load notes.</Alert>;
  }

  const notesArray = notes || [];
  const subjects = subjectsData || [];
  const categories = categoriesData || [];

  const getFileHref = (note) => {
    const filePath = note.attachment_url || note.attachment || note.file_url || note.file;
    if (!filePath) return '';
    if (filePath.startsWith('http')) return filePath;
    const base = (axios.defaults.baseURL || '').replace('/api', '');
    return `${base}${filePath}`;
  };

  const handleViewReaders = async (note) => {
    setViewsError('');
    setViewsLoading(true);
    setViewsList([]);
    setSelectedNoteForViews(note);
    setViewsOpen(true);
    try {
      const res = await axios.get(`/notes/${note.id}/views/`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setViewsList(list);
    } catch (err) {
      setViewsError(err.response?.data?.detail || 'Failed to load views');
    } finally {
      setViewsLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3} justifyContent="space-between">
        <Box display="flex" alignItems="center">
          <NoteIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Notes Management</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setOpenDialog(true);
            setError('');
          }}
        >
          Add Note
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Note Categories ({categories.length})</Typography>
          <Button variant="outlined" onClick={() => setCategoryDialogOpen(true)}>
            Add Category
          </Button>
        </Box>
        {categories.length === 0 ? (
          <Typography color="text.secondary">No categories yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.description || '-'}</TableCell>
                    <TableCell>
                      <Chip label={c.color || '#28a745'} sx={{ backgroundColor: c.color || '#28a745', color: '#fff' }} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteCategoryMutation.mutate(c.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Notes ({notesArray.length})
        </Typography>
        {notesArray.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No notes found. Add your first note!
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notesArray.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{n.title || 'Note'}</TableCell>
                    <TableCell>{n.subject_name || n.subject || '-'}</TableCell>
                    <TableCell>
                      <Chip label={n.category_name || n.category || 'File'} size="small" />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const href = getFileHref(n);
                        if (!href) return '-';
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        );
                      })()}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Views">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewReaders(n)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteNoteMutation.mutate(n.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add Note Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Add Note</DialogTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          createNoteMutation.mutate({ ...formData, file }, {
            onSettled: () => setLoading(false),
          });
        }}
      >
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Subject</InputLabel>
                <Select
                  label="Subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  disabled={subjectsLoading || subjects.length === 0}
                >
                  {subjects.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name || `Subject ${s.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  disabled={categoriesLoading || categories.length === 0}
                >
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name || `Category ${c.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="file"
                inputProps={{ accept: 'application/pdf,image/*' }}
                onChange={handleFileChange}
                helperText="Upload PDF or image"
              />
            </Grid>
            {(subjects.length === 0 || categories.length === 0) && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  Subjects and categories must exist before uploading notes.
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || subjects.length === 0 || categories.length === 0 || !formData.subject || !formData.category}
          >
            {loading ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </form>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Category</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createCategoryMutation.mutate(categoryForm);
          }}
        >
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  helperText="Hex color like #28a745"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!categoryForm.name}>
              Create
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Views Dialog */}
      <Dialog open={viewsOpen} onClose={() => setViewsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Note Views {selectedNoteForViews ? `- ${selectedNoteForViews.title}` : ''}</DialogTitle>
        <DialogContent>
          {viewsError && <Alert severity="error" sx={{ mb: 2 }}>{viewsError}</Alert>}
          {viewsLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="20vh">
              <CircularProgress />
            </Box>
          ) : viewsList.length === 0 ? (
            <Typography>No student has opened this note yet.</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Roll No</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell>Student ID</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Section</TableCell>
                    <TableCell>Last Opened</TableCell>
                    <TableCell>Views</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewsList.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.roll_number || '-'}</TableCell>
                      <TableCell>{v.student_name || '-'}</TableCell>
                      <TableCell>{v.student_id || '-'}</TableCell>
                      <TableCell>{v.current_class || '-'}</TableCell>
                      <TableCell>{v.current_section || '-'}</TableCell>
                      <TableCell>{v.last_viewed_at ? new Date(v.last_viewed_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>{v.view_count || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotesManagement;

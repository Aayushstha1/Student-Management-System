import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const Notes = () => {
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

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
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
    onError: (e) => setError(e.response?.data?.message || 'Failed to create note'),
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

  const notes = data || [];
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
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Notes & Materials</Typography>
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
      <Paper>
        <List>
          {notes.map((n, i) => {
            const href = getFileHref(n);
            return (
              <ListItem key={n.id || i} divider>
                <ListItemText
                  primary={n.title || 'Note'}
                  secondary={n.subject_name || n.subject || ''}
                />
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {href ? (
                    <Chip
                      label="Open file"
                      component="a"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      color="primary"
                    />
                  ) : (
                    <Chip label={n.category_name || n.category || 'File'} />
                  )}
                  <Button size="small" variant="outlined" onClick={() => handleViewReaders(n)}>
                    Views
                  </Button>
                </Box>
              </ListItem>
            );
          })}
          {notes.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No notes yet."
                secondary="Use 'Add Note' to upload study material."
              />
            </ListItem>
          )}
        </List>
      </Paper>

      {/* Add Note Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Note</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            createNoteMutation.mutate(
              {
                title: formData.title,
                subject: formData.subject,
                category: formData.category,
                file,
              },
              {
                onSettled: () => setLoading(false),
              },
            );
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
                    Subjects and categories must exist before uploading notes. Ask admin to create them.
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
            <Paper variant="outlined" sx={{ mt: 1 }}>
              <List dense>
                {viewsList.map((v) => (
                  <ListItem key={v.id} divider>
                    <ListItemText
                      primary={`${v.student_name || 'Student'} ${v.roll_number ? `(${v.roll_number})` : ''}`}
                      secondary={`ID: ${v.student_id || '-'} • ${v.current_class || '-'} ${v.current_section || ''} • Last opened: ${v.last_viewed_at ? new Date(v.last_viewed_at).toLocaleString() : '-' } • Views: ${v.view_count || 0}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Notes;



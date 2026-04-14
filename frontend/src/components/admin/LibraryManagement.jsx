import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Chip, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch,
  Tabs, Tab
} from '@mui/material';
import {
  LibraryBooks as LibraryIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  MenuBook as MenuBookIcon, CheckCircle as CheckCircleIcon, LocalLibrary as LocalLibraryIcon, ErrorOutline as ErrorIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import ClassSubjectsManagement from './ClassSubjectsManagement';
import { useLocation } from 'react-router-dom';

const categories = [
  'computer_science',
  'literature',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'economics',
  'textbook',
  'reference',
  'novel',
  'magazine',
  'journal',
  'other',
];

const categoryLabelMap = {
  computer_science: 'Computer Science',
  literature: 'Literature',
  mathematics: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  economics: 'Economics',
  textbook: 'Textbook',
  reference: 'Reference',
  novel: 'Novel',
  magazine: 'Magazine',
  journal: 'Journal',
  other: 'Other',
};

class LibraryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('LibraryManagement crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Library page crashed. Please refresh. If it happens again, send the console error.
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

const LibraryManagement = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState('optional');
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    title: '', author: '', isbn: '', category: 'textbook', class_name: '', subject: '', publisher: '', publication_year: '', total_copies: 1, available_copies: 1, copy_numbers: '', shelf_number: '', description: '', is_fixed: false
  });
  const [coverFile, setCoverFile] = useState(null);
  const [bookFile, setBookFile] = useState(null);
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#class-subjects') {
      setActiveTab(1);
    }
  }, [location.hash]);

  const queryClient = useQueryClient();

  // CRUD Books
  const { data: books, isLoading: booksLoading, error: booksError } = useQuery({
    queryKey: ['books'],
    queryFn: async () => (await axios.get('/library/books/')).data,
  });

  const { data: statsData } = useQuery({
    queryKey: ['library-stats-admin'],
    queryFn: async () => (await axios.get('/library/stats/')).data,
  });

  const { data: issuesData } = useQuery({
    queryKey: ['library-issues-admin'],
    queryFn: async () => (await axios.get('/library/issues/')).data,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => (await axios.get('/attendance/subjects/')).data,
  });

  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subject-assignments'],
    queryFn: async () => (await axios.get('/results/class-subjects/')).data,
  });

  const formatError = (e) => {
    const data = e?.response?.data;
    if (!data) return 'Failed to create book';
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    return Object.entries(data)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join(' | ');
  };

  const createBookMutation = useMutation({
    mutationFn: async (book) => {
      const payload = { ...book };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') delete payload[k]; });
      const formDataToSend = new FormData();
      Object.keys(payload).forEach((k) => formDataToSend.append(k, payload[k]));
      if (coverFile) formDataToSend.append('cover_image', coverFile);
      if (bookFile) formDataToSend.append('file', bookFile);
      return (await axios.post('/library/books/', formDataToSend)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['books']);
      setOpenDialog(false);
      setFormData({ title: '', author: '', isbn: '', category: 'textbook', class_name: '', subject: '', publisher: '', publication_year: '', total_copies: 1, available_copies: 1, copy_numbers: '', shelf_number: '', description: '', is_fixed: false });
      setCoverFile(null);
      setBookFile(null);
    },
    onError: (e) => setError(formatError(e))
  });

  const updateBookMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const payload = { ...updates };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') delete payload[k]; });
      const formDataToSend = new FormData();
      Object.keys(payload).forEach((k) => formDataToSend.append(k, payload[k]));
      if (coverFile) formDataToSend.append('cover_image', coverFile);
      if (bookFile) formDataToSend.append('file', bookFile);
      return (await axios.put(`/library/books/${id}/`, formDataToSend)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['books']);
      setOpenEditDialog(false);
      setSelectedBook(null);
      setCoverFile(null);
      setBookFile(null);
    },
    onError: (e) => setError(formatError(e))
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (id) => await axios.delete(`/library/books/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries(['books']);
      setOpenDeleteDialog(false);
      setSelectedBook(null);
    },
    onError: (e) => setError(formatError(e))
  });

  // Analytics queries
  const { data: viewsData } = useQuery({
    queryKey: ['book-views'],
    queryFn: async () => (await axios.get('/library/book-views/')).data,
  });

  const { data: chartDataData } = useQuery({
    queryKey: ['most-viewed-books'],
    queryFn: async () => (await axios.get('/library/most-viewed-books/')).data,
  });

  const handleInputChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); setError(''); };
  const handleToggleChange = (e) => {
    const checked = e.target.checked;
    setFormData({
      ...formData,
      [e.target.name]: checked,
      ...(checked ? {} : { class_name: '', subject: '' })
    });
    setError('');
  };
  const handleTabChange = (event, value) => {
    setActiveTab(value);
    if (value === 1) {
      if (location.hash !== '#class-subjects') {
        window.history.replaceState(null, '', `${location.pathname}#class-subjects`);
      }
    } else if (location.hash) {
      window.history.replaceState(null, '', location.pathname);
    }
  };

  const normalizeClassValue = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let normalized = raw.replace(/^(class|cls)\s*[-:_]*\s*/i, '');
    normalized = normalized.replace(/[/_-]+/g, ' ');
    normalized = normalized.replace(/(\d)([A-Za-z])/g, '$1 $2');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
  };

  const parseClassSection = (value) => {
    const normalized = normalizeClassValue(value);
    if (!normalized) return { className: '', section: '' };
    const parts = normalized.split(' ');
    if (parts.length === 1) return { className: normalized, section: '' };
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]{1,3}$/.test(last)) {
      return { className: parts.slice(0, -1).join(' '), section: last };
    }
    return { className: normalized, section: '' };
  };
  const handleCoverChange = (e) => {
    const selected = e.target.files && e.target.files[0];
    setCoverFile(selected || null);
    setError('');
  };
  const handleBookFileChange = (e) => {
    const selected = e.target.files && e.target.files[0];
    setBookFile(selected || null);
    setError('');
  };

  const booksArray = Array.isArray(books) ? books : (books?.results || []);
  const issuesArray = Array.isArray(issuesData) ? issuesData : (issuesData?.results || []);
  const viewsArray = Array.isArray(viewsData) ? viewsData : (viewsData?.results || []);
  const chartData = Array.isArray(chartDataData) ? chartDataData : (chartDataData?.results || []);
  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c, label: categoryLabelMap[c] || c })), []);
  const subjectsArray = Array.isArray(subjectsData) ? subjectsData : (subjectsData?.results || []);
  const classSubjectsArray = Array.isArray(classSubjectsData) ? classSubjectsData : (classSubjectsData?.results || []);

  const { className: formClass, section: formSection } = useMemo(
    () => parseClassSection(formData.class_name),
    [formData.class_name]
  );

  const subjectOptions = useMemo(() => {
    if (!subjectsArray.length) return [];
    if (!formClass) {
      return subjectsArray.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
    }

    const matching = classSubjectsArray.filter((cs) => {
      const classMatches = normalizeClassValue(cs.class_name) === normalizeClassValue(formClass);
      if (!classMatches) return false;
      if (!formSection) return true;
      return String(cs.section || '').toLowerCase() === String(formSection || '').toLowerCase();
    });

    const allowedIds = new Set(matching.map((cs) => String(cs.subject)));
    const list = subjectsArray.filter((s) => allowedIds.has(String(s.id)));
    const base = list.length ? list : subjectsArray;
    return base.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
  }, [subjectsArray, classSubjectsArray, formClass, formSection]);

  if (booksLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (booksError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load library data. Please refresh.</Alert>
      </Box>
    );
  }

  return (
    <LibraryErrorBoundary>
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #0f766e, #0d9488)', color: 'white' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <LibraryIcon sx={{ fontSize: 32, mr: 2, color: 'white' }} />
            <Box>
              <Typography variant="h4">Library Management</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Explore and manage your library resources efficiently</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setAddDialogMode('optional');
                setFormData({
                  title: '', author: '', isbn: '', category: 'textbook', class_name: '', subject: '', publisher: '',
                  publication_year: '', total_copies: 1, available_copies: 1, copy_numbers: '', shelf_number: '',
                  description: '', is_fixed: false
                });
                setOpenDialog(true);
                setCoverFile(null);
                setBookFile(null);
                setError('');
              }}
            >
              Add Optional Book
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setAddDialogMode('fixed');
                setFormData({
                  title: '', author: '', isbn: '', category: 'textbook', class_name: '', subject: '', publisher: '',
                  publication_year: '', total_copies: 1, available_copies: 1, copy_numbers: '', shelf_number: '',
                  description: '', is_fixed: true
                });
                setOpenDialog(true);
                setCoverFile(null);
                setBookFile(null);
                setError('');
              }}
            >
              Add Fixed Book
            </Button>
          </Box>
        </Box>
      </Paper>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Books" />
        <Tab label="Fixed Subjects" />
      </Tabs>

      {activeTab === 0 && (
      <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Books', value: statsData?.total_books || 0, icon: <MenuBookIcon />, color: '#2563eb' },
          { label: 'Available', value: statsData?.available_books || 0, icon: <CheckCircleIcon />, color: '#059669' },
          { label: 'Borrowed', value: statsData?.borrowed_books || 0, icon: <LocalLibraryIcon />, color: '#0ea5e9' },
          { label: 'Overdue', value: statsData?.overdue_books || 0, icon: <ErrorIcon />, color: '#ef4444' },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${card.color}22`, color: card.color, display: 'grid', placeItems: 'center' }}>
                {card.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{card.value}</Typography>
                <Typography variant="caption" color="text.secondary">{card.label}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Books Table */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>Books ({booksArray.length})</Typography>
        {booksArray.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No books found. Add your first book!</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Fixed</TableCell>
                  <TableCell>ISBN</TableCell>
                  <TableCell>Copies</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {booksArray.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell>{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>{categoryLabelMap[book.category] || book.category}</TableCell>
                    <TableCell>{book.class_name || '-'}</TableCell>
                    <TableCell>{book.subject_name || book.subject_code || '-'}</TableCell>
                    <TableCell>
                      <Chip label={book.is_fixed ? 'Fixed' : 'Optional'} color={book.is_fixed ? 'primary' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>{book.isbn || '-'}</TableCell>
                    <TableCell>{book.available_copies}/{book.total_copies}</TableCell>
                    <TableCell>
                      <Chip label={book.is_active ? 'Active' : 'Inactive'} color={book.is_active ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => {
                          setSelectedBook(book);
                          setFormData({
                            title: book.title || '', author: book.author || '', isbn: book.isbn || '', category: book.category || 'textbook',
                            class_name: book.class_name || '', subject: book.subject ? String(book.subject) : '', publisher: book.publisher || '', publication_year: book.publication_year || '', total_copies: book.total_copies || 1,
                            available_copies: book.available_copies || 1, copy_numbers: book.copy_numbers || '', shelf_number: book.shelf_number || '', description: book.description || '', is_fixed: !!book.is_fixed
                          });
                          setCoverFile(null);
                          setBookFile(null);
                          setOpenEditDialog(true); setError('');
                        }}><EditIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => { setSelectedBook(book); setOpenDeleteDialog(true); setError(''); }}><DeleteIcon /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Analytics Table */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" mb={2}>Borrowed Books</Typography>
        {issuesArray.length === 0 ? (
          <Typography color="text.secondary">No issued books yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Book</TableCell>
                <TableCell>Issued Date</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issuesArray.slice(0, 20).map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell>{issue.student_name || issue.student_id || '-'}</TableCell>
                  <TableCell>{issue.book_title || issue.book}</TableCell>
                  <TableCell>{issue.issued_date ? new Date(issue.issued_date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>{issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <Chip label={issue.status} size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Analytics Table */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" mb={2}>Book Views</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Book</TableCell>
              <TableCell>Student</TableCell>
              <TableCell>Viewed At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {viewsArray.map((v, i) => (
              <TableRow key={i}>
                <TableCell>{v.book_title}</TableCell>
                <TableCell>{v.student_name}</TableCell>
                <TableCell>{new Date(v.viewed_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Most Viewed Books Chart */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" mb={2}>Most Viewed Books</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="title" />
            <YAxis />
            <RechartsTooltip />
            <Bar dataKey="total_views" fill="#1976d2" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>
      </>
      )}

      {activeTab === 1 && (
        <Box id="class-subjects">
          <ClassSubjectsManagement />
        </Box>
      )}

      {/* Dialogs: Add/Edit/Delete */}
      {/* Add Book Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{addDialogMode === 'fixed' ? 'Add Fixed Book' : 'Add Optional Book'}</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); createBookMutation.mutate(formData); }}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Title" name="title" value={formData.title} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Author" name="author" value={formData.author} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="ISBN" name="isbn" value={formData.isbn} onChange={handleInputChange} /></Grid>
              <Grid item xs={12} sm={6}><FormControl fullWidth required><InputLabel>Category</InputLabel>
                <Select name="category" value={formData.category} onChange={handleInputChange}>
                  {categoryOptions.map((c) => (<MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>))}
                </Select>
              </FormControl></Grid>
                {addDialogMode === 'fixed' && (
                  <>
                    <Grid item xs={12} sm={6}><TextField fullWidth label="Class" name="class_name" value={formData.class_name} onChange={handleInputChange} required helperText="Required for fixed books" /></Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Subject</InputLabel>
                        <Select name="subject" value={formData.subject} onChange={handleInputChange} label="Subject">
                          <MenuItem value="">None</MenuItem>
                          {subjectOptions.map((s) => (
                            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}><TextField fullWidth label="Publisher" name="publisher" value={formData.publisher} onChange={handleInputChange} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Publication Year" name="publication_year" type="number" value={formData.publication_year} onChange={handleInputChange} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Total Copies" name="total_copies" type="number" value={formData.total_copies} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Available Copies" name="available_copies" type="number" value={formData.available_copies} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Book Numbers (comma or new line)"
                  name="copy_numbers"
                  value={formData.copy_numbers}
                  onChange={handleInputChange}
                  multiline
                  rows={2}
                  helperText="Optional. If provided, total copies will be set from this list."
                />
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Shelf Number" name="shelf_number" value={formData.shelf_number} onChange={handleInputChange} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Description" name="description" value={formData.description} onChange={handleInputChange} multiline rows={3} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="file" inputProps={{ accept: 'image/*' }} onChange={handleCoverChange} helperText={coverFile ? `Cover: ${coverFile.name}` : 'Cover image'} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="file" inputProps={{ accept: 'application/pdf' }} onChange={handleBookFileChange} helperText={bookFile ? `PDF: ${bookFile.name}` : 'Book file (PDF)'} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createBookMutation.isPending}>
              {createBookMutation.isPending ? <CircularProgress size={24} /> : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Book Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Book</DialogTitle>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedBook) return;
          updateBookMutation.mutate({ id: selectedBook.id, updates: formData });
        }}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Title" name="title" value={formData.title} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Author" name="author" value={formData.author} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="ISBN" name="isbn" value={formData.isbn} onChange={handleInputChange} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth required><InputLabel>Category</InputLabel>
                  <Select name="category" value={formData.category} onChange={handleInputChange}>
                    {categoryOptions.map((c) => (<MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>))}
                  </Select>
                </FormControl></Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={<Switch checked={!!formData.is_fixed} onChange={handleToggleChange} name="is_fixed" />}
                    label="Fixed for this class"
                  />
                </Grid>
                {formData.is_fixed && (
                  <>
                    <Grid item xs={12} sm={6}><TextField fullWidth label="Class" name="class_name" value={formData.class_name} onChange={handleInputChange} required helperText="Required for fixed books" /></Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Subject</InputLabel>
                        <Select name="subject" value={formData.subject} onChange={handleInputChange} label="Subject">
                          <MenuItem value="">None</MenuItem>
                          {subjectOptions.map((s) => (
                            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}><TextField fullWidth label="Publisher" name="publisher" value={formData.publisher} onChange={handleInputChange} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Publication Year" name="publication_year" type="number" value={formData.publication_year} onChange={handleInputChange} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Total Copies" name="total_copies" type="number" value={formData.total_copies} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Available Copies" name="available_copies" type="number" value={formData.available_copies} onChange={handleInputChange} required /></Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Book Numbers (comma or new line)"
                  name="copy_numbers"
                  value={formData.copy_numbers}
                  onChange={handleInputChange}
                  multiline
                  rows={2}
                  helperText="Optional. If provided, total copies will be set from this list."
                />
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Shelf Number" name="shelf_number" value={formData.shelf_number} onChange={handleInputChange} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Description" name="description" value={formData.description} onChange={handleInputChange} multiline rows={3} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="file" inputProps={{ accept: 'image/*' }} onChange={handleCoverChange} helperText={coverFile ? `Cover: ${coverFile.name}` : 'Replace cover image'} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="file" inputProps={{ accept: 'application/pdf' }} onChange={handleBookFileChange} helperText={bookFile ? `PDF: ${bookFile.name}` : 'Replace book file (PDF)'} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateBookMutation.isPending}>
              {updateBookMutation.isPending ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Book Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Delete Book</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete "{selectedBook?.title}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => selectedBook && deleteBookMutation.mutate(selectedBook.id)}
            disabled={deleteBookMutation.isPending}
          >
            {deleteBookMutation.isPending ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </LibraryErrorBoundary>
  );
};

export default LibraryManagement;

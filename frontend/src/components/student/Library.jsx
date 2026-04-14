import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  MenuBook,
  CheckCircle,
  LocalLibrary,
  ErrorOutline,
  CalendarMonth,
  EventAvailable,
  Inventory2,
  TaskAlt,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const durationOptions = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '3 Weeks', days: 21 },
  { label: '1 Month', days: 30 },
];

const accent = '#0f766e';
const accentDark = '#0b5d57';
const accentChip = '#d1fae5';
const cardShadow = '0 8px 18px rgba(15, 118, 110, 0.08)';

const filterCategories = [
  'all',
  'computer_science',
  'literature',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'economics',
];

const categoryLabel = {
  computer_science: 'Computer Science',
  literature: 'Literature',
  mathematics: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  economics: 'Economics',
  textbook: 'Textbook',
  reference: 'Reference',
  novel: 'Literature',
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
    console.error('Student library crashed:', error, info);
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

const LibraryContent = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBook, setSelectedBook] = useState(null);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [durationDays, setDurationDays] = useState(14);
  const [borrowError, setBorrowError] = useState('');
  const [borrowSuccess, setBorrowSuccess] = useState('');
  const [borrowLoading, setBorrowLoading] = useState(false);

  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
    error: statsLoadError,
  } = useQuery({
    queryKey: ['library-stats-student'],
    queryFn: async () => (await axios.get('/library/stats/')).data,
    enabled: isAuthenticated,
  });

  const {
    data: booksData,
    isLoading: isBooksLoading,
    isError: isBooksError,
    error: booksLoadError,
  } = useQuery({
    queryKey: ['library-books-student'],
    queryFn: async () => {
      const res = await axios.get('/library/books/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    enabled: isAuthenticated,
  });

  const {
    data: issuesData,
    isLoading: issuesLoading,
    isError: issuesError,
  } = useQuery({
    queryKey: ['library-issues-student'],
    queryFn: async () => {
      const res = await axios.get('/library/issues/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    enabled: isAuthenticated,
  });

  const booksArray = Array.isArray(booksData) ? booksData : [];
  const issuesArray = Array.isArray(issuesData) ? issuesData : [];
  const activeIssues = useMemo(
    () => issuesArray.filter((issue) => ['issued', 'overdue'].includes((issue.status || '').toLowerCase())),
    [issuesArray]
  );
  const booksById = useMemo(() => {
    const map = new Map();
    booksArray.forEach((book) => {
      if (book?.id !== undefined && book?.id !== null) {
        map.set(String(book.id), book);
      }
    });
    return map;
  }, [booksArray]);

  const categories = useMemo(() => filterCategories, []);

  const filteredBooks = useMemo(() => {
    return booksArray.filter((b) => {
      if (!b || typeof b !== 'object') return false;
      const matchesSearch = `${b.title || ''} ${b.author || ''} ${b.isbn || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' ? true : b.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [booksArray, searchTerm, selectedCategory]);

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Alert severity="warning">
        Your session expired. Please log in again.
      </Alert>
    );
  }

  if (isBooksLoading || statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isBooksError) {
    const status = booksLoadError?.response?.status;
    const isUnauthorized = status === 401 || status === 403;
    return (
      <Alert severity="error">
        {isUnauthorized ? 'Your session expired. Please log in again.' : 'Failed to load library data.'}
        {!isUnauthorized && booksLoadError?.response?.data?.detail ? ` ${booksLoadError.response.data.detail}` : ''}
      </Alert>
    );
  }

  const getCoverUrl = (book) => {
    const filePath = book.cover_image_url || book.cover_image;
    if (!filePath || typeof filePath !== 'string') return '';
    if (filePath.startsWith('http')) return filePath;
    const base = axios.defaults.baseURL || '';
    const root = base.includes('/api') ? base.replace('/api', '') : base;
    return `${root}${filePath}`;
  };

  const getFileUrl = (book) => {
    const filePath = book?.file;
    if (!filePath || typeof filePath !== 'string') return '';
    if (filePath.startsWith('http')) return filePath;
    const base = axios.defaults.baseURL || '';
    const root = base.includes('/api') ? base.replace('/api', '') : base;
    return `${root}${filePath}`;
  };

  const openBorrow = (book) => {
    setSelectedBook(book);
    setDurationDays(14);
    setBorrowError('');
    setBorrowSuccess('');
    setBorrowOpen(true);
  };

  const handleBorrow = async () => {
    if (!selectedBook) return;
    try {
      setBorrowLoading(true);
      setBorrowError('');
      await axios.post('/library/borrow/', {
        book_id: selectedBook.id,
        duration_days: durationDays,
      });
      setBorrowSuccess('Book borrowed successfully');
      setBorrowOpen(false);
      queryClient.invalidateQueries({ queryKey: ['library-books-student'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats-student'] });
      queryClient.invalidateQueries({ queryKey: ['library-issues-student'] });
    } catch (err) {
      setBorrowError(err.response?.data?.detail || 'Failed to borrow book');
    } finally {
      setBorrowLoading(false);
    }
  };

  const borrowDate = new Date();
  const dueDate = new Date(borrowDate);
  dueDate.setDate(dueDate.getDate() + durationDays);
  const formatDate = (date) =>
    date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const statusColor = (status) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'issued') return 'warning';
    if (normalized === 'overdue') return 'error';
    if (normalized === 'returned') return 'success';
    return 'default';
  };

  const getIssueBook = (issue) => {
    if (!issue) return null;
    const key = issue.book !== undefined && issue.book !== null ? String(issue.book) : '';
    return key ? booksById.get(key) : null;
  };

  const getIssueType = (issue) => {
    const book = getIssueBook(issue);
    if (!book) return { label: 'Unknown', color: 'default' };
    if (book.is_fixed) return { label: 'Regular', color: 'success' };
    return { label: 'Extra', color: 'warning' };
  };

  return (
    <Box>
      {borrowSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBorrowSuccess('')}>
          {borrowSuccess}
        </Alert>
      )}
      {borrowError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBorrowError('')}>
          {borrowError}
        </Alert>
      )}

      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
          color: 'white',
          borderRadius: 3,
          boxShadow: cardShadow,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Library Management
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Explore and manage your library resources efficiently
        </Typography>
      </Paper>

      {statsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Library stats are unavailable right now.
          {statsLoadError?.response?.data?.detail ? ` ${statsLoadError.response.data.detail}` : ''}
        </Alert>
      )}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Books', value: statsData?.total_books || 0, icon: <MenuBook />, color: '#2563eb' },
          { label: 'Available', value: statsData?.available_books || 0, icon: <CheckCircle />, color: '#059669' },
          { label: 'Borrowed', value: statsData?.borrowed_books || 0, icon: <LocalLibrary />, color: '#0ea5e9' },
          { label: 'Overdue', value: statsData?.overdue_books || 0, icon: <ErrorOutline />, color: '#ef4444' },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2.5, boxShadow: cardShadow }}>
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

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2.5, boxShadow: cardShadow }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          Your Books
        </Typography>
        {issuesLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="120px">
            <CircularProgress size={28} />
          </Box>
        ) : issuesError ? (
          <Alert severity="error">Failed to load your borrowed books.</Alert>
        ) : activeIssues.length === 0 ? (
          <Typography color="text.secondary">No borrowed books yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Book</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>PDF</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeIssues.map((issue) => {
                  const typeMeta = getIssueType(issue);
                  const issueBook = getIssueBook(issue);
                  const fileUrl = issueBook ? getFileUrl(issueBook) : '';
                  return (
                    <TableRow key={issue.id}>
                      <TableCell>{issue.book_title || getIssueBook(issue)?.title || 'Book'}</TableCell>
                      <TableCell>{issue.due_date || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={(issue.status || 'issued').toUpperCase()}
                          color={statusColor(issue.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={typeMeta.label} color={typeMeta.color} />
                      </TableCell>
                      <TableCell>
                        {typeMeta.label === 'Extra' ? (
                          fileUrl ? (
                            <Button
                              size="small"
                              variant="outlined"
                              component="a"
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open PDF
                            </Button>
                          ) : (
                            <Chip size="small" label="Missing PDF" color="error" />
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2.5, boxShadow: cardShadow }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #e5e7eb', borderRadius: 2, px: 2, py: 1, bgcolor: '#fff' }}>
            <SearchIcon fontSize="small" color="action" />
            <TextField
              variant="standard"
              placeholder="Search books by title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              InputProps={{ disableUnderline: true }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat === 'all' ? 'All' : (categoryLabel[cat] || cat)}
                clickable
                onClick={() => setSelectedCategory(cat)}
                variant="outlined"
                sx={{
                  borderColor: selectedCategory === cat ? accent : '#e5e7eb',
                  bgcolor: selectedCategory === cat ? accent : '#fff',
                  color: selectedCategory === cat ? '#fff' : 'text.primary',
                  fontWeight: selectedCategory === cat ? 600 : 500,
                }}
              />
            ))}
          </Box>
        </Box>
      </Paper>

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {filteredBooks.length} Books Found
      </Typography>

      <Grid container spacing={2}>
        {filteredBooks.map((book) => {
          const coverUrl = getCoverUrl(book);
          return (
            <Grid item xs={12} sm={6} md={3} key={book.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2.5, boxShadow: cardShadow, border: '1px solid #eef2f7' }}>
                {coverUrl ? (
                  <CardMedia component="img" height="180" image={coverUrl} alt={book.title} sx={{ objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ height: 180, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">No Cover</Typography>
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Chip label={categoryLabel[book.category] || 'General'} size="small" sx={{ mb: 1, bgcolor: accentChip, color: accentDark, fontWeight: 600 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{book.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{book.author}</Typography>
                  <Typography variant="caption" color="text.secondary">ISBN: {book.isbn || '-'}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: book.available_copies > 0 ? 'success.main' : 'error.main' }}>
                    {book.available_copies} available / {book.total_copies} total
                  </Typography>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ bgcolor: accent, '&:hover': { bgcolor: accentDark }, textTransform: 'none', fontWeight: 600 }}
                    disabled={book.available_copies <= 0}
                    onClick={() => openBorrow(book)}
                  >
                    Borrow Book
                  </Button>
                </Box>
              </Card>
            </Grid>
          );
        })}
        {filteredBooks.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography>No books match your search.</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Dialog open={borrowOpen} onClose={() => setBorrowOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: accent, color: 'white', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center' }}>
              <MenuBook fontSize="small" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Borrow Book</Typography>
          </Box>
          <IconButton onClick={() => setBorrowOpen(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {borrowError && <Alert severity="error" sx={{ mb: 2 }}>{borrowError}</Alert>}
          {selectedBook && (
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Box sx={{ width: 90, height: 120, bgcolor: '#f1f5f9', borderRadius: 1.5, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                {getCoverUrl(selectedBook) ? (
                  <img src={getCoverUrl(selectedBook)} alt={selectedBook.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedBook.title}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedBook.author}</Typography>
                <Chip label={categoryLabel[selectedBook.category] || 'General'} size="small" sx={{ mt: 1, bgcolor: accentChip, color: accentDark }} />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>ISBN: {selectedBook.isbn || '-'}</Typography>
              </Box>
            </Box>
          )}

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>Borrowing Duration</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {durationOptions.map((d) => (
              <Chip
                key={d.days}
                label={d.label}
                clickable
                sx={{
                  borderColor: durationDays === d.days ? accent : '#e5e7eb',
                  bgcolor: durationDays === d.days ? accent : '#f8fafc',
                  color: durationDays === d.days ? '#fff' : 'text.primary',
                  fontWeight: durationDays === d.days ? 600 : 500,
                }}
                onClick={() => setDurationDays(d.days)}
              />
            ))}
          </Box>

          <Box sx={{ mt: 3, display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonth fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">Borrow Date</Typography>
              </Box>
              <Typography variant="body2">{formatDate(borrowDate)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventAvailable fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">Due Date</Typography>
              </Box>
              <Typography variant="body2">{formatDate(dueDate)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Inventory2 fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">Copies Available</Typography>
              </Box>
              <Typography variant="body2" color="success.main">
                {selectedBook?.available_copies || 0} of {selectedBook?.total_copies || 0}
              </Typography>
            </Box>
          </Box>

          <Paper sx={{ mt: 2, p: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Please return the book on or before the due date to avoid overdue status.
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setBorrowOpen(false)} sx={{ borderColor: '#e5e7eb', color: 'text.primary' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBorrow}
            disabled={borrowLoading}
            startIcon={<TaskAlt />}
            sx={{ bgcolor: accent, '&:hover': { bgcolor: accentDark }, textTransform: 'none', fontWeight: 600 }}
          >
            {borrowLoading ? 'Processing...' : 'Confirm Borrow'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const Library = () => (
  <LibraryErrorBoundary>
    <LibraryContent />
  </LibraryErrorBoundary>
);

export default Library;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
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
  Stack,
  Avatar,
  AppBar,
  Toolbar,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { LocalLibrary, Search as SearchIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RequestsInbox from '../requests/RequestsInbox';

const durationOptions = [7, 14, 21, 30];

const LibraryStaffDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [searchClass, setSearchClass] = useState('');
  const [searchSection, setSearchSection] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchInfo, setSearchInfo] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [bookNumbers, setBookNumbers] = useState('');
  const [durationDays, setDurationDays] = useState(14);
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [showFixedOnly, setShowFixedOnly] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');

  const parseCopyNumbers = (value) => {
    if (!value) return [];
    const raw = String(value);
    const tokens = [];
    raw.replace(/\n/g, ',').replace(/;/g, ',').split(',').forEach((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;
      trimmed.split(/\s+/).forEach((part) => {
        const t = part.trim();
        if (t) tokens.push(t);
      });
    });
    return Array.from(new Set(tokens));
  };

  const getBookNumberLabel = (book) => {
    const numbers = parseCopyNumbers(book?.copy_numbers);
    if (!numbers.length) return String(book?.id ?? '');
    if (numbers.length <= 3) return numbers.join(', ');
    return `${numbers.slice(0, 3).join(', ')} +${numbers.length - 3}`;
  };

  const tokenMatchesBook = (token, book) => {
    const trimmed = String(token || '').trim();
    if (!trimmed) return false;
    if (String(book?.id) === trimmed) return true;
    if (book?.isbn && String(book.isbn).trim() === trimmed) return true;
    const numbers = parseCopyNumbers(book?.copy_numbers);
    return numbers.includes(trimmed);
  };

  const validateTokensAgainstBooks = (tokens, booksPool) => {
    const valid = [];
    const invalid = [];
    tokens.forEach((t) => {
      const ok = booksPool.some((b) => tokenMatchesBook(t, b));
      if (ok) valid.push(t);
      else invalid.push(t);
    });
    return { valid, invalid };
  };

  const resolveStudentPhoto = (student) => {
    const url = student?.profile_picture_url || student?.profile_picture || student?.user_details?.profile_picture;
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = axios.defaults.baseURL || '';
    const root = base.includes('/api') ? base.replace('/api', '') : base;
    return `${root}${url}`;
  };

  const getFileUrl = (book) => {
    const filePath = book?.file;
    if (!filePath || typeof filePath !== 'string') return '';
    if (filePath.startsWith('http')) return filePath;
    const base = axios.defaults.baseURL || '';
    const root = base.includes('/api') ? base.replace('/api', '') : base;
    return `${root}${filePath}`;
  };

  const handleSearch = async (e, overrides = {}) => {
    if (e?.preventDefault) e.preventDefault();
    setSearching(true);
    setSearchError('');
    setSearchInfo('');
    setSearchResults([]);
    try {
      const params = new URLSearchParams();
      const nameValue = (overrides.name ?? searchName).trim();
      const classValue = (overrides.className ?? searchClass).trim();
      const sectionValue = (overrides.section ?? searchSection).trim();

      if (nameValue) params.append('query', nameValue);
      if (classValue) params.append('class', classValue);
      if (sectionValue) params.append('section', sectionValue);

      let url = '/students/search/';
      const queryString = params.toString();
      if (queryString) url = `${url}?${queryString}`;

      let list = [];
      while (url) {
        const res = await axios.get(url);
        const data = res.data;
        if (Array.isArray(data)) {
          list = data;
          url = null;
        } else {
          list = list.concat(data?.results || []);
          url = data?.next || null;
        }
      }

      setSearchResults(list);
      if (!list.length) {
        setSearchInfo('No students found for this filter.');
      }
    } catch (err) {
      setSearchError(err.response?.data?.detail || 'Failed to search students.');
    } finally {
      setSearching(false);
    }
  };

  const handleClearFilters = () => {
    setSearchClass('');
    setSearchSection('');
    setSearchName('');
    handleSearch(null, { name: '', className: '', section: '' });
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const { data: classBooks, isLoading: booksLoading, error: booksError } = useQuery({
    queryKey: ['library-books-class', selectedStudent?.current_class, selectedStudent?.current_section],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStudent?.current_class) params.append('class', selectedStudent.current_class);
      if (selectedStudent?.current_section) params.append('section', selectedStudent.current_section);
      const queryString = params.toString();
      const res = await axios.get(`/library/books/${queryString ? `?${queryString}` : ''}`);
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    enabled: !!selectedStudent?.current_class,
  });

  const { data: allBooks } = useQuery({
    queryKey: ['library-books-all'],
    queryFn: async () => {
      const res = await axios.get('/library/books/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const { data: studentIssues } = useQuery({
    queryKey: ['library-issues-staff', selectedStudent?.id],
    queryFn: async () => {
      const res = await axios.get(`/library/issues/?student_id=${selectedStudent?.id}`);
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    enabled: !!selectedStudent?.id,
  });

  const { data: allIssues, isLoading: allIssuesLoading, isError: allIssuesError } = useQuery({
    queryKey: ['library-issues-all'],
    queryFn: async () => {
      const res = await axios.get('/library/issues/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const booksArray = classBooks || [];
  const fallbackBooks = allBooks || [];
  const issuesArray = studentIssues || [];
  const allIssuesArray = allIssues || [];
  const allBooksArray = allBooks || [];
  const allBooksById = useMemo(() => {
    const map = new Map();
    allBooksArray.forEach((book) => {
      if (book?.id !== undefined && book?.id !== null) {
        map.set(String(book.id), book);
      }
    });
    return map;
  }, [allBooksArray]);
  const getIssueBook = (issue) => {
    if (!issue) return null;
    const key = issue.book !== undefined && issue.book !== null ? String(issue.book) : '';
    return key ? allBooksById.get(key) : null;
  };
  const getIssueType = (issue) => {
    const book = getIssueBook(issue);
    if (!book) return { label: 'Unknown', color: 'default' };
    if (book.is_fixed) return { label: 'Regular', color: 'success' };
    return { label: 'Extra', color: 'warning' };
  };
  const extraIssues = useMemo(() => {
    return allIssuesArray.filter((issue) => getIssueType(issue).label === 'Extra');
  }, [allIssuesArray, allBooksById]);
  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects', selectedStudent?.current_class, selectedStudent?.current_section],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStudent?.current_class) params.append('class_name', selectedStudent.current_class);
      if (selectedStudent?.current_section) params.append('section', selectedStudent.current_section);
      const queryString = params.toString();
      const res = await axios.get(`/results/class-subjects/${queryString ? `?${queryString}` : ''}`);
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    enabled: !!selectedStudent?.current_class,
  });
  const classSubjectsArray = classSubjectsData || [];
  const hasFixedSubjects = classSubjectsArray.length > 0;
  const subjectOptions = useMemo(() => {
    const map = new Map();
    classSubjectsArray.forEach((cs) => {
      const id = String(cs.subject);
      if (!map.has(id)) {
        const label = cs.subject_code ? `${cs.subject_name} (${cs.subject_code})` : cs.subject_name;
        map.set(id, { value: id, label });
      }
    });
    return Array.from(map.values());
  }, [classSubjectsArray]);
  const fixedSubjectIds = useMemo(() => {
    return new Set(classSubjectsArray.map((cs) => String(cs.subject)));
  }, [classSubjectsArray]);
  const showAllClassesFallback = useMemo(() => {
    return !!selectedStudent && booksArray.length === 0;
  }, [selectedStudent, booksArray.length]);

  const booksToRender = showAllClassesFallback ? fallbackBooks : booksArray;

  const visibleBooks = useMemo(() => {
    let list = booksToRender;
    if (showFixedOnly) {
      list = list.filter((book) => {
        const fixedBySubject = fixedSubjectIds.has(String(book.subject));
        return book.is_fixed || fixedBySubject;
      });
    }
    if (selectedSubject) {
      list = list.filter((book) => String(book.subject) === String(selectedSubject));
    }
    return list;
  }, [booksToRender, showFixedOnly, selectedSubject, fixedSubjectIds]);

  const fixedSubjectRows = useMemo(() => {
    if (!showFixedOnly || !classSubjectsArray.length) return [];
    const subjectsWithBooks = new Set(
      visibleBooks
        .filter((book) => book.subject !== null && book.subject !== undefined)
        .map((book) => String(book.subject))
    );
    return classSubjectsArray
      .filter((cs) => !subjectsWithBooks.has(String(cs.subject)))
      .map((cs) => ({
        id: `subject-${cs.id}`,
        isPlaceholder: true,
        subject_name: cs.subject_name,
        subject_code: cs.subject_code,
      }));
  }, [showFixedOnly, classSubjectsArray, visibleBooks]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setIssueError('');
    setIssueSuccess('');
    setBookNumbers('');
    setSelectedSubject('');
    setShowFixedOnly(false);
  };

  useEffect(() => {
    if (selectedStudent) {
      setSelectedSubject('');
    }
  }, [selectedStudent]);

  const handleAddBookNumber = (book) => {
    if (!book?.id || !selectedStudent) {
      setIssueError('Select a student first.');
      return;
    }
    const existingTokens = parseCopyNumbers(bookNumbers);
    const numbers = parseCopyNumbers(book.copy_numbers);
    if (numbers.length) {
      const nextNumber = numbers.find((n) => !existingTokens.includes(n));
      if (nextNumber) {
        const next = bookNumbers ? `${bookNumbers}, ${nextNumber}` : nextNumber;
        setBookNumbers(next);
        setIssueError('');
      }
      else {
        setIssueError('All copy numbers for this book are already added.');
      }
      return;
    }
    const id = String(book.id);
    if (!existingTokens.includes(id)) {
      const next = bookNumbers ? `${bookNumbers}, ${id}` : id;
      setBookNumbers(next);
      setIssueError('');
    } else {
      setIssueError('This book is already added.');
    }
  };

  const handleAddFixedSubjectNumber = (subjectId) => {
    if (!selectedStudent) {
      setIssueError('Select a student first.');
      return;
    }
    const subjectBooks = booksArray.filter((book) => String(book.subject) === String(subjectId));
    const booksPool = subjectBooks.length ? subjectBooks : booksArray;
    if (!booksPool.length) {
      setIssueError('No books available to add.');
      return;
    }
    const nextBook = booksPool.find((book) => !parseCopyNumbers(bookNumbers).includes(String(book.id)));
    if (!nextBook) {
      setIssueError('All books for this subject are already added.');
      return;
    }
    handleAddBookNumber(nextBook);
  };

  const handleIssue = async () => {
    if (!selectedStudent) {
      setIssueError('Select a student first.');
      return;
    }
    if (!bookNumbers.trim()) {
      setIssueError('Enter book numbers (IDs or ISBN).');
      return;
    }
    setIssuing(true);
    setIssueError('');
    setIssueSuccess('');
    try {
      const resp = await axios.post('/library/staff-issue/', {
        student_id: selectedStudent.id,
        book_numbers: bookNumbers,
        duration_days: durationDays,
      });
      const issued = resp.data?.issued || [];
      const errors = resp.data?.errors || [];
      let msg = `${issued.length} book(s) issued successfully.`;
      if (errors.length) {
        msg += ` ${errors.length} failed.`;
      }
      setIssueSuccess(msg);
      if (errors.length) {
        setIssueError(errors.map((e) => `${e.token}: ${e.error}`).join(' | '));
      }
    } catch (err) {
      setIssueError(err.response?.data?.detail || 'Failed to issue books.');
    } finally {
      setIssuing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const studentPhoto = useMemo(() => resolveStudentPhoto(selectedStudent), [selectedStudent]);
  const selectedClassLabel = useMemo(() => {
    if (!selectedStudent) return 'Class';
    const cls = selectedStudent.current_class || '';
    const sec = selectedStudent.current_section ? ` ${selectedStudent.current_section}` : '';
    return `Class ${cls}${sec}`.trim();
  }, [selectedStudent]);
  const selectedBookNumbers = useMemo(() => parseCopyNumbers(bookNumbers), [bookNumbers]);

  return (
    <Box>
      <AppBar position="static" sx={{ mb: 3, background: 'linear-gradient(135deg, #0f766e, #0d9488)' }}>
        <Toolbar>
          <LocalLibrary sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Library Staff Dashboard
          </Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ mb: 3 }}>
        <RequestsInbox title="Book Requests Inbox" dense />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Student List</Typography>
            {searchError && <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>}
            {searchInfo && <Alert severity="info" sx={{ mb: 2 }}>{searchInfo}</Alert>}
            <form onSubmit={handleSearch}>
              <TextField
                fullWidth
                label="Class"
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Section (optional)"
                value={searchSection}
                onChange={(e) => setSearchSection(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Student Name or ID"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SearchIcon />}
                  type="submit"
                  disabled={searching}
                >
                  {searching ? 'Searching...' : 'Apply Filter'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleClearFilters}
                  disabled={searching}
                  type="button"
                >
                  Clear
                </Button>
              </Stack>
            </form>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Students ({searchResults.length})
              </Typography>
              {searching ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : searchResults.length === 0 ? (
                <Typography color="text.secondary">No students to show.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {searchResults.map((student) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const fullName = `${student.user_details?.first_name || ''} ${student.user_details?.last_name || ''}`.trim();
                    const classLabel = `Class ${student.current_class || '-'}` + (student.current_section ? ` ${student.current_section}` : '');
                    const rollLabel = student.roll_number ? `Roll ${student.roll_number}` : 'Roll -';
                    const email = student.user_details?.email || '-';
                    const phone = student.user_details?.phone || student.guardian_contact || '-';
                    const father = student.father_name || '-';
                    return (
                      <Paper
                        key={student.id}
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #0f766e' : '1px solid #e5e7eb',
                        }}
                        onClick={() => handleSelectStudent(student)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar src={resolveStudentPhoto(student) || undefined} />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {fullName || student.student_id || 'Student'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              ID: {student.student_id || '-'} | {classLabel} | {rollLabel}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Email: {email} | Phone: {phone}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Father: {father}
                            </Typography>
                          </Box>
                          <Button size="small" variant={isSelected ? 'contained' : 'outlined'}>
                            {isSelected ? 'Selected' : 'Select'}
                          </Button>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Student Profile</Typography>
            {!selectedStudent ? (
              <Alert severity="info">Select a student to view profile.</Alert>
            ) : (
              <Box display="flex" gap={2} alignItems="center">
                <Avatar src={studentPhoto || undefined} sx={{ width: 72, height: 72 }} />
                <Box>
                  <Typography variant="h6">
                    {selectedStudent.user_details?.first_name} {selectedStudent.user_details?.last_name}
                  </Typography>
                  <Typography variant="body2">
                    {selectedStudent.student_id} - Class {selectedStudent.current_class} {selectedStudent.current_section}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Roll: {selectedStudent.roll_number || '-'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Issue Books</Typography>
            {issueError && <Alert severity="error" sx={{ mb: 1 }}>{issueError}</Alert>}
            {issueSuccess && <Alert severity="success" sx={{ mb: 1 }}>{issueSuccess}</Alert>}
            <TextField
              fullWidth
              label="Selected Books"
              value={`${selectedBookNumbers.length} selected`}
              InputProps={{ readOnly: true }}
              helperText="Click Add in the table to queue books, then click Issue Books."
              sx={{ mb: 2 }}
            />
            {selectedBookNumbers.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                sx={{ mb: 2 }}
                onClick={() => setBookNumbers('')}
              >
                Clear Selection
              </Button>
            )}
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
              {durationOptions.map((d) => (
                <Chip
                  key={d}
                  label={`${d} days`}
                  clickable
                  color={durationDays === d ? 'primary' : 'default'}
                  onClick={() => setDurationDays(d)}
                />
              ))}
            </Stack>
            <Button variant="contained" onClick={handleIssue} disabled={issuing}>
              {issuing ? 'Issuing...' : 'Issue Books'}
            </Button>
          </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">Books for {selectedClassLabel}</Typography>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Subject</InputLabel>
                  <Select
                    value={selectedSubject}
                    label="Subject"
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <MenuItem value="">All Subjects</MenuItem>
                    {subjectOptions.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={showFixedOnly}
                      onChange={(e) => setShowFixedOnly(e.target.checked)}
                      color="primary"
                    />
                  )}
                  label="Show only fixed books"
                />
                </Stack>
              </Box>
              {!selectedStudent && (
                <Alert severity="info" sx={{ mb: 2 }}>Select a student to load books.</Alert>
              )}
              {booksError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load books. Please refresh.
                </Alert>
              )}
              {showAllClassesFallback && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No class‑specific books found. Showing all books instead.
                </Alert>
              )}
              {booksLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {!showFixedOnly && <TableCell>Title</TableCell>}
                      {!showFixedOnly && <TableCell>Author</TableCell>}
                      <TableCell>Subject</TableCell>
                      <TableCell>Fixed</TableCell>
                      {!showFixedOnly && <TableCell>Available</TableCell>}
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleBooks.map((book) => {
                      const fixedBySubject = fixedSubjectIds.has(String(book.subject));
                      const isFixedForClass = book.is_fixed || fixedBySubject;
                      const fixedLabel = book.is_fixed
                        ? 'Fixed'
                        : fixedBySubject
                        ? 'Fixed (Subject)'
                        : 'Optional';
                      return (
                      <TableRow
                        key={book.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleAddBookNumber(book)}
                      >
                        {!showFixedOnly && <TableCell>{book.title}</TableCell>}
                        {!showFixedOnly && <TableCell>{book.author}</TableCell>}
                        <TableCell>{book.subject_name || book.subject_code || '-'}</TableCell>
                        <TableCell>
                          <Chip label={fixedLabel} size="small" color={isFixedForClass ? 'primary' : 'default'} />
                        </TableCell>
                        {!showFixedOnly && (
                          <TableCell>{book.available_copies}/{book.total_copies}</TableCell>
                        )}
                        <TableCell>
                        <Button
                          size="small"
                          disabled={!selectedStudent}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddBookNumber(book);
                        }}
                      >
                        Add
                      </Button>
                        </TableCell>
                      </TableRow>
                    )})}
                      {showFixedOnly && fixedSubjectRows.map((row) => (
                        <TableRow key={row.id} hover>
                          {!showFixedOnly && <TableCell>No book assigned</TableCell>}
                          {!showFixedOnly && <TableCell>—</TableCell>}
                          <TableCell>{row.subject_code ? `${row.subject_name} (${row.subject_code})` : row.subject_name}</TableCell>
                          <TableCell>
                            <Chip label="Fixed (Subject)" size="small" color="primary" />
                          </TableCell>
                          {!showFixedOnly && <TableCell>—</TableCell>}
                          <TableCell>
                            <Button
                              size="small"
                              onClick={() => handleAddFixedSubjectNumber(row.subject)}
                            >
                              Add
                            </Button>
                          </TableCell>
                      </TableRow>
                    ))}
                    {visibleBooks.length === 0 && (!showFixedOnly || fixedSubjectRows.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={showFixedOnly ? 2 : 4} align="center">
                          {showFixedOnly
                            ? (classSubjectsArray.length ? 'No fixed books assigned to these subjects.' : 'No fixed subjects for this class.')
                            : 'No books for this class.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Current Borrowed Books</Typography>
            {issuesArray.length === 0 ? (
              <Typography color="text.secondary">No borrowed books yet.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Book</TableCell>
                    <TableCell>Issued</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>PDF</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issuesArray.map((issue) => {
                    const typeMeta = getIssueType(issue);
                    const issueBook = getIssueBook(issue);
                    const fileUrl = issueBook ? getFileUrl(issueBook) : '';
                    return (
                      <TableRow key={issue.id}>
                        <TableCell>{issue.book_title || issue.book}</TableCell>
                        <TableCell>{issue.issued_date}</TableCell>
                        <TableCell>{issue.due_date}</TableCell>
                        <TableCell>
                          <Chip label={issue.status} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip label={typeMeta.label} size="small" color={typeMeta.color} />
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
            )}
          </Paper>

          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Extra Borrowed Books (All Students)</Typography>
            {allIssuesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : allIssuesError ? (
              <Alert severity="error">Failed to load extra book records.</Alert>
            ) : extraIssues.length === 0 ? (
              <Typography color="text.secondary">No extra book records yet.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Book</TableCell>
                    <TableCell>Issued</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>PDF</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {extraIssues.map((issue) => {
                    const issueBook = getIssueBook(issue);
                    const fileUrl = issueBook ? getFileUrl(issueBook) : '';
                    return (
                      <TableRow key={issue.id}>
                        <TableCell>
                          {issue.student_name || issue.student_id || 'Student'}
                        </TableCell>
                        <TableCell>{issue.book_title || issueBook?.title || 'Book'}</TableCell>
                        <TableCell>{issue.issued_date || '-'}</TableCell>
                        <TableCell>{issue.due_date || '-'}</TableCell>
                        <TableCell>
                          <Chip label={issue.status || 'issued'} size="small" />
                        </TableCell>
                        <TableCell>
                          {fileUrl ? (
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
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LibraryStaffDashboard;

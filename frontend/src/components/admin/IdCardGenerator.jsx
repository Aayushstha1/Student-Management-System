import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  Stack,
  GlobalStyles,
} from '@mui/material';
import { Print as PrintIcon, Refresh as RefreshIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const normalize = (value) => String(value || '').trim().toLowerCase();

const IdCardGenerator = () => {
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['id-card-students'],
    queryFn: async () => {
      let url = '/students/';
      let results = [];
      while (url) {
        const res = await axios.get(url);
        if (Array.isArray(res.data)) {
          results = res.data;
          url = null;
        } else {
          results = results.concat(res.data?.results || []);
          url = res.data?.next || null;
        }
      }
      return results;
    },
  });

  const students = Array.isArray(data) ? data : (data?.results || []);
  const classes = useMemo(() => {
    const values = new Set();
    students.forEach((s) => {
      if (s.current_class) values.add(String(s.current_class));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const sections = useMemo(() => {
    const values = new Set();
    students.forEach((s) => {
      if (classFilter && normalize(s.current_class) !== normalize(classFilter)) return;
      if (s.current_section) values.add(String(s.current_section));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, classFilter]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (classFilter && normalize(s.current_class) !== normalize(classFilter)) return false;
      if (sectionFilter && normalize(s.current_section) !== normalize(sectionFilter)) return false;
      if (search) {
        const target = `${s.student_id || ''} ${s.admission_number || ''} ${s.user_details?.first_name || ''} ${s.user_details?.last_name || ''} ${s.current_class || ''} ${s.current_section || ''}`;
        if (!target.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [students, classFilter, sectionFilter, search]);

  const mediaBase = (axios.defaults.baseURL || '').replace('/api', '');
  const buildMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${mediaBase}${url}`;
  };
  const withCacheBust = (url, version) => {
    if (!url) return '';
    if (url.includes('v=')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${version || Date.now()}`;
  };

  const getStudentName = (student) => {
    const first = student.user_details?.first_name || '';
    const last = student.user_details?.last_name || '';
    const name = `${first} ${last}`.trim();
    return name || student.user || student.student_id || 'Student';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    setClassFilter('');
    setSectionFilter('');
    setSearch('');
  };

  return (
    <Box>
      <GlobalStyles
        styles={{
          '@media print': {
            body: { background: '#fff' },
            '.no-print': { display: 'none !important' },
            '.id-card': { breakInside: 'avoid', pageBreakInside: 'avoid' },
            '.id-card-grid': { gap: '8px' },
          },
        }}
      />

      <Paper className="no-print" sx={{ p: 3, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              ID Card Generator
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generate printable ID cards with QR, photo, and class/section.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
              Print
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Class</InputLabel>
            <Select
              value={classFilter}
              label="Class"
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSectionFilter('');
              }}
            >
              <MenuItem value="">All</MenuItem>
              {classes.map((cls) => (
                <MenuItem key={cls} value={cls}>{cls}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={sectionFilter}
              label="Section"
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {sections.map((sec) => (
                <MenuItem key={sec} value={sec}>{sec}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID, admission..."
            sx={{ flex: 1 }}
          />
          <Button variant="text" startIcon={<ClearIcon />} onClick={handleClear}>
            Clear
          </Button>
        </Stack>
      </Paper>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Failed to load students.</Alert>}

      {!isLoading && !error && (
        <Box className="id-card-grid" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
          {filtered.map((student) => {
            const photoUrl = buildMediaUrl(student.profile_picture_url || student.user_details?.profile_picture);
            const qrRaw = buildMediaUrl(student.qr_code_url || student.qr_code);
            const qrUrl = withCacheBust(qrRaw, student.updated_at ? new Date(student.updated_at).getTime() : null);
            const name = getStudentName(student);
            return (
              <Paper key={student.id} className="id-card" elevation={3} sx={{ p: 1.5, borderRadius: 2, height: 200, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                    School ID Card
                  </Typography>
                  <Typography variant="caption">
                    {student.current_class || '-'} {student.current_section || ''}
                  </Typography>
                </Box>

                <Box display="flex" gap={1.5} alignItems="center">
                  <Avatar
                    variant="rounded"
                    src={photoUrl}
                    sx={{ width: 64, height: 64, bgcolor: '#e0e0e0', fontSize: 18 }}
                  >
                    {name?.[0] || 'S'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {name}
                    </Typography>
                    <Typography variant="caption" display="block">
                      ID: {student.student_id || '-'}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Roll: {student.roll_number || '-'}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Section: {student.current_section || '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 72, height: 72, border: '1px solid #e0e0e0', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {qrUrl ? (
                      <img src={qrUrl} alt="QR" style={{ width: 64, height: 64 }} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">No QR</Typography>
                    )}
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption">Adm: {student.admission_number || '-'}</Typography>
                  <Typography variant="caption">Class: {student.current_class || '-'}</Typography>
                </Box>
              </Paper>
            );
          })}
          {filtered.length === 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography>No students match the filters.</Typography>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};

export default IdCardGenerator;

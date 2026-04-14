import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Button,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/FileDownload';
import axios from 'axios';
import './profile.css';

const PublicStudentProfile = () => {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    axios.get(`/students/public/${studentId}/`)
      .then((resp) => { if (mounted) setData(resp.data); })
      .catch((err) => { if (mounted) setError(err.response?.data?.detail || 'Failed to load profile'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [studentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh"><CircularProgress /></Box>;
  if (error) return <Box p={3}><Typography color="error">{error}</Typography></Box>;
  if (!data) return null;

  const mediaBase = (axios.defaults.baseURL || '').replace('/api', '');
  const buildMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${mediaBase}${url}`;
  };
  const qrUrl = buildMediaUrl(data.qr_code_url) || data.profile_url;
  const hostel = data.hostel || null;
  const hostelFees = data.hostel_fees || null;
  const parents = Array.isArray(data.parents) ? data.parents : [];
  const attendance = data.attendance || null;

  const renderKeyValueTable = (rows) => (
    <TableContainer sx={{ mt: 1, border: '1px solid #eef2f7', borderRadius: 2 }}>
      <Table size="small">
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell sx={{ fontWeight: 600, width: '40%' }}>{row.label}</TableCell>
              <TableCell>{row.value ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box p={3} display="flex" justifyContent="center">
      <Paper className="printable public-profile" sx={{ p: 3, maxWidth: 800, width: '100%' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" className="school-name">Your Institution Name</Typography>
            <Typography variant="subtitle2" color="text.secondary">Public Student Profile</Typography>
          </Box>
          <Stack direction="row" spacing={1} className="no-print">
            {qrUrl && (
              <Button variant="outlined" startIcon={<OpenInNewIcon />} href={qrUrl} target="_blank">Open QR</Button>
            )}
            {qrUrl && (
              <Button variant="outlined" startIcon={<DownloadIcon />} href={qrUrl} target="_blank" download>Download QR</Button>
            )}
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>Print</Button>
          </Stack>
        </Box>

        <Box display="flex" gap={3} alignItems="center" mb={2}>
          {data.user?.profile_picture ? (
            <img
              alt="profile"
              style={{ width: 112, height: 112, borderRadius: 8 }}
              src={data.user.profile_picture.startsWith('http') ? data.user.profile_picture : `${axios.defaults.baseURL.replace('/api','')}${data.user.profile_picture}`}
            />
          ) : (
            <Box sx={{ width: 112, height: 112, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1 }}>No Image</Box>
          )}

          <Box sx={{ flex: 1 }}>
            <Typography variant="h4">{data.name}</Typography>
            <Typography variant="body1">Student ID: {data.student_id}</Typography>
            <Typography variant="body2">Class: {data.class} - Section: {data.section}</Typography>
            <Typography variant="body2">Roll: {data.roll_number}</Typography>
          </Box>

          <Box>
            {qrUrl ? (
              <img alt="QR" style={{ width: 160, height: 160 }} src={qrUrl} />
            ) : (
              <Typography color="text.secondary">No QR available</Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ mt: 1 }}>
          <Typography variant="h6">Borrowed Books</Typography>
          {data.borrowed_books && data.borrowed_books.length ? (
            <TableContainer sx={{ mt: 1, border: '1px solid #eef2f7', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Issued</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.borrowed_books.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>{b.title}</TableCell>
                      <TableCell>{b.issued_date || '-'}</TableCell>
                      <TableCell>{b.status || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">No borrowed books.</Typography>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Recent Results</Typography>
          {data.recent_results && data.recent_results.length ? (
            <TableContainer sx={{ mt: 1, border: '1px solid #eef2f7', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Exam</TableCell>
                    <TableCell>Marks</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recent_results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.exam}</TableCell>
                      <TableCell>{r.marks_obtained}/{r.total_marks}</TableCell>
                      <TableCell>{r.grade}</TableCell>
                      <TableCell>{r.passed ? 'Pass' : 'Fail'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">No recent results.</Typography>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Parents / Guardians</Typography>
          {parents.length ? (
            <TableContainer sx={{ mt: 1, border: '1px solid #eef2f7', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Relation</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Email</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parents.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.relation}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.phone || '-'}</TableCell>
                      <TableCell>{p.email || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            renderKeyValueTable([
              { label: 'Father', value: data.father_name || '-' },
              { label: 'Mother', value: data.mother_name || '-' },
              { label: 'Guardian Contact', value: data.guardian_contact || '-' },
            ])
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Attendance Summary</Typography>
          {attendance ? (
            <TableContainer sx={{ mt: 1, border: '1px solid #eef2f7', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Present</TableCell>
                    <TableCell>Late</TableCell>
                    <TableCell>Absent</TableCell>
                    <TableCell>Excused</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>All Time</TableCell>
                    <TableCell>{attendance.total}</TableCell>
                    <TableCell>{attendance.present}</TableCell>
                    <TableCell>{attendance.late}</TableCell>
                    <TableCell>{attendance.absent}</TableCell>
                    <TableCell>{attendance.excused}</TableCell>
                  </TableRow>
                  {attendance.last_30_days && (
                    <TableRow>
                      <TableCell>Last 30 Days</TableCell>
                      <TableCell>{attendance.last_30_days.total}</TableCell>
                      <TableCell>{attendance.last_30_days.present}</TableCell>
                      <TableCell>{attendance.last_30_days.late}</TableCell>
                      <TableCell>{attendance.last_30_days.absent}</TableCell>
                      <TableCell>{attendance.last_30_days.excused}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">No attendance records.</Typography>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Hostel</Typography>
          {hostel ? (
            renderKeyValueTable([
              { label: 'Hostel', value: hostel.hostel_name },
              { label: 'Room', value: hostel.room_number ? `${hostel.room_number} (${hostel.room_type})` : '-' },
              { label: 'Monthly Rent', value: hostel.monthly_rent },
              { label: 'Allocated', value: hostel.allocated_date || '-' },
              { label: 'Hostel Fees Due', value: hostelFees ? `${hostelFees.pending_total} (Count: ${hostelFees.pending_count})` : '-' },
            ])
          ) : (
            <Typography color="text.secondary">Not a hostel resident.</Typography>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">Profile link: {data.profile_url ? <a href={data.profile_url} target="_blank" rel="noreferrer">Open profile</a> : 'Not available'}</Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PublicStudentProfile;

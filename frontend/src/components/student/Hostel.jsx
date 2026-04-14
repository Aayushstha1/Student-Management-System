import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const Hostel = () => {
  const queryClient = useQueryClient();
  const [hostelFilter, setHostelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [occupantOpen, setOccupantOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [maintenanceError, setMaintenanceError] = useState('');
  const [maintenanceSuccess, setMaintenanceSuccess] = useState('');
  const [maintenanceForm, setMaintenanceForm] = useState({
    room: '',
    issue: '',
    priority: 'medium',
  });
  const [leaveForm, setLeaveForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  const { data: hostelsData, isLoading: hostelsLoading } = useQuery({
    queryKey: ['hostel-public-hostels'],
    queryFn: async () => (await axios.get('/hostel/public/hostels/')).data,
  });

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['hostel-public-rooms'],
    queryFn: async () => (await axios.get('/hostel/public/rooms/')).data,
  });

  const { data: allocationsData, isLoading: allocationsLoading } = useQuery({
    queryKey: ['hostel-public-allocations'],
    queryFn: async () => (await axios.get('/hostel/public/allocations/')).data,
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['hostel-room-requests'],
    queryFn: async () => (await axios.get('/hostel/requests/')).data,
  });

  const { data: profileData } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => (await axios.get('/students/profile/')).data,
  });

  const { data: messData, isLoading: messLoading } = useQuery({
    queryKey: ['hostel-mess-menus'],
    queryFn: async () => (await axios.get('/hostel/mess-menus/')).data,
  });

  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['hostel-maintenance'],
    queryFn: async () => (await axios.get('/hostel/maintenance/')).data,
  });
  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ['hostel-leave-requests'],
    queryFn: async () => (await axios.get('/hostel/leave-requests/')).data,
  });

  const hostels = Array.isArray(hostelsData) ? hostelsData : (hostelsData?.results || []);
  const rooms = Array.isArray(roomsData) ? roomsData : (roomsData?.results || []);
  const allocations = Array.isArray(allocationsData) ? allocationsData : (allocationsData?.results || []);
  const requests = Array.isArray(requestsData) ? requestsData : (requestsData?.results || []);
  const messMenus = Array.isArray(messData) ? messData : (messData?.results || []);
  const maintenanceRequests = Array.isArray(maintenanceData) ? maintenanceData : (maintenanceData?.results || []);
  const leaveRequests = Array.isArray(leaveData) ? leaveData : (leaveData?.results || []);

  const pendingMaintenanceRequests = useMemo(
    () => maintenanceRequests.filter((req) => req.status !== 'completed'),
    [maintenanceRequests]
  );

  const pendingRequest = requests.find((req) => req.status === 'pending');
  const approvedRequest = requests.find((req) => req.status === 'approved');
  const canRequest = !pendingRequest && !approvedRequest;

  const getRoomStatus = (room) => {
    if (!room.is_active) return 'maintenance';
    const available = room.available_beds ?? Math.max((room.capacity || 0) - (room.current_occupancy || 0), 0);
    if (available <= 0) return 'occupied';
    if ((room.current_occupancy || 0) > 0) return 'partial';
    return 'vacant';
  };

  const getLeaveStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending_parent':
        return 'warning';
      case 'pending_warden':
      default:
        return 'info';
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (hostelFilter && String(room.hostel) !== String(hostelFilter)) return false;
      if (search && !String(room.room_number || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rooms, hostelFilter, search]);

  const roomsByFloor = useMemo(() => {
    const grouped = {};
    filteredRooms.forEach((room) => {
      const numeric = parseInt(room.room_number, 10);
      let label = 'Other';
      if (!Number.isNaN(numeric)) {
        const floor = Math.floor(numeric / 100);
        label = floor === 0 ? 'Ground Floor' : `${floor} Floor`;
      }
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(room);
    });
    return grouped;
  }, [filteredRooms]);

  const occupantsByRoom = useMemo(() => {
    const map = new Map();
    allocations.forEach((alloc) => {
      const key = String(alloc.room_id);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(alloc);
    });
    return map;
  }, [allocations]);

  const selectedOccupants = selectedRoom ? (occupantsByRoom.get(String(selectedRoom.id)) || []) : [];
  const studentId = profileData?.student_id;
  const activeAllocation = allocations.find((alloc) => String(alloc.student_id) === String(studentId));
  const isHostelResident = Boolean(studentId && activeAllocation);
  const mediaBase = (axios.defaults.baseURL || '').replace('/api', '');
  const getAvatarUrl = (occupant) => {
    const direct = occupant.profile_picture_url;
    if (!direct) return '';
    if (direct.startsWith('http')) return direct;
    return `${mediaBase}${direct}`;
  };

  useEffect(() => {
    if (isHostelResident && activeAllocation && !maintenanceForm.room) {
      setMaintenanceForm((prev) => ({ ...prev, room: activeAllocation.room }));
    }
  }, [isHostelResident, activeAllocation, maintenanceForm.room]);

  const createRequest = useMutation({
    mutationFn: async (roomId) => axios.post('/hostel/requests/', { room: roomId }),
    onSuccess: () => {
      setRequestError('');
      setRequestSuccess('Request sent to warden.');
      queryClient.invalidateQueries(['hostel-room-requests']);
    },
    onError: (err) => {
      const data = err?.response?.data;
      const message = data?.detail
        || (typeof data === 'object' ? Object.values(data).flat().join(' ') : '')
        || 'Failed to send request.';
      setRequestError(message);
      setRequestSuccess('');
    }
  });

  const createMaintenance = useMutation({
    mutationFn: async () => axios.post('/hostel/maintenance/', maintenanceForm),
    onSuccess: () => {
      setMaintenanceError('');
      setMaintenanceSuccess('Maintenance request sent to warden.');
      setMaintenanceForm((prev) => ({ ...prev, issue: '' }));
      queryClient.invalidateQueries(['hostel-maintenance']);
    },
    onError: (err) => {
      const data = err?.response?.data;
      const message = data?.detail
        || (typeof data === 'object' ? Object.values(data).flat().join(' ') : '')
        || 'Failed to submit maintenance request.';
      setMaintenanceError(message);
      setMaintenanceSuccess('');
    }
  });

  const createLeave = useMutation({
    mutationFn: async () => axios.post('/hostel/leave-requests/', leaveForm),
    onSuccess: () => {
      setLeaveError('');
      setLeaveSuccess('Leave request sent to warden.');
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
      queryClient.invalidateQueries(['hostel-leave-requests']);
    },
    onError: (err) => {
      const data = err?.response?.data;
      const message = data?.detail
        || (typeof data === 'object' ? Object.values(data).flat().join(' ') : '')
        || 'Failed to submit leave request.';
      setLeaveError(message);
      setLeaveSuccess('');
    }
  });

  const latestRequest = requests[0];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h5">Hostel Room Request</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a room and send a request to the warden. You can request again after a rejection.
        </Typography>
      </Paper>

      {(hostelsLoading || roomsLoading || requestsLoading || allocationsLoading || messLoading || maintenanceLoading || leaveLoading) && (
        <CircularProgress />
      )}

      {requestError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRequestError('')}>
          {requestError}
        </Alert>
      )}

      {requestSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRequestSuccess('')}>
          {requestSuccess}
        </Alert>
      )}

      {maintenanceError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMaintenanceError('')}>
          {maintenanceError}
        </Alert>
      )}

      {maintenanceSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMaintenanceSuccess('')}>
          {maintenanceSuccess}
        </Alert>
      )}

      {leaveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLeaveError('')}>
          {leaveError}
        </Alert>
      )}

      {leaveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setLeaveSuccess('')}>
          {leaveSuccess}
        </Alert>
      )}

      {!canRequest && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {pendingRequest ? 'You already have a pending request.' : 'Your request is approved and room is booked.'}
        </Alert>
      )}

      {latestRequest && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Latest Request</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip label={`Status: ${latestRequest.status}`} />
            <Typography variant="body2">
              Room {latestRequest.room_number} - {latestRequest.hostel_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Requested on {latestRequest.requested_on?.slice(0, 10) || '-'}
            </Typography>
          </Stack>
        </Paper>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Hostel Leave Request</Typography>
        <Typography variant="body2" color="text.secondary">
          Submit a leave request. Warden approval is required first, then parent consent.
        </Typography>

        {!isHostelResident && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Only hostel residents can request leave.
          </Alert>
        )}

        {isHostelResident && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                InputLabelProps={{ shrink: true }}
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                InputLabelProps={{ shrink: true }}
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Reason"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                disabled={!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason || createLeave.isLoading}
                onClick={() => createLeave.mutate()}
              >
                Send Leave Request
              </Button>
            </Grid>
          </Grid>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Your Leave Requests</Typography>
          {leaveLoading ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Warden Note</TableCell>
                    <TableCell>Parent Note</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaveRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{req.start_date}</TableCell>
                      <TableCell>{req.end_date}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={getLeaveStatusColor(req.status)}
                          label={String(req.status || '').replace('_', ' ')}
                        />
                      </TableCell>
                      <TableCell>{req.warden_note || '-'}</TableCell>
                      <TableCell>{req.parent_note || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {leaveRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No leave requests yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Hostel</InputLabel>
            <Select
              label="Hostel"
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {hostels.map((h) => (
                <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Search room number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Rooms</Typography>
        {(roomsLoading || allocationsLoading) ? (
          <CircularProgress />
        ) : (
          <>
            {Object.entries(roomsByFloor).map(([floor, floorRooms]) => (
              <Box key={floor} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>{floor}</Typography>
                <Grid container spacing={2}>
                  {floorRooms.map((room) => {
                    const available = room.available_beds ?? Math.max((room.capacity || 0) - (room.current_occupancy || 0), 0);
                    const status = getRoomStatus(room);
                    const occupants = occupantsByRoom.get(String(room.id)) || [];
                    const statusColor = {
                      occupied: '#10b981',
                      vacant: '#e5e7eb',
                      partial: '#fbbf24',
                      maintenance: '#f87171',
                    }[status] || '#e5e7eb';
                    return (
                      <Grid item xs={12} sm={6} md={3} key={room.id}>
                        <Paper sx={{ p: 2, backgroundColor: statusColor, color: status === 'vacant' ? '#111827' : '#0f172a' }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6">{room.room_number}</Typography>
                            <Chip size="small" label={status} />
                          </Box>
                          <Typography variant="body2">{room.room_type} room</Typography>
                          <Typography variant="caption">
                            {room.current_occupancy || 0}/{room.capacity || 0} occupied
                          </Typography>
                          <Typography variant="caption" display="block">
                            Available: {available}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Rent: {room.monthly_rent}
                          </Typography>
                          <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!canRequest || available <= 0 || createRequest.isLoading}
                              onClick={() => createRequest.mutate(room.id)}
                            >
                              Request
                            </Button>
                            {occupants.length > 0 && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setOccupantOpen(true);
                                }}
                              >
                                View Occupants
                              </Button>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
                {floorRooms.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No rooms here.</Typography>
                )}
              </Box>
            ))}
            {filteredRooms.length === 0 && (
              <Typography color="text.secondary">No rooms found.</Typography>
            )}
          </>
        )}
      </Paper>

      {isHostelResident && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Report Maintenance</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Room</InputLabel>
                <Select
                  label="Room"
                  value={maintenanceForm.room}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, room: e.target.value })}
                >
                  {rooms.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      {room.hostel_name} - Room {room.room_number}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={maintenanceForm.priority}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Issue"
                value={maintenanceForm.issue}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, issue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                disabled={!maintenanceForm.room || !maintenanceForm.issue || createMaintenance.isLoading}
                onClick={() => createMaintenance.mutate()}
              >
                Submit to Warden
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Pending Maintenance</Typography>
        {maintenanceLoading ? (
          <CircularProgress />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Room</TableCell>
                  <TableCell>Issue</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Approved</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingMaintenanceRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.room_number}</TableCell>
                    <TableCell>{req.issue}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={(req.status || '').replace('_', ' ')}
                        color={req.status === 'completed' ? 'success' : req.status === 'in_progress' ? 'info' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={req.is_approved ? 'Approved' : 'Pending'}
                        color={req.is_approved ? 'success' : 'warning'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {pendingMaintenanceRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">No pending maintenance requests.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {isHostelResident && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Mess / Daily Menu</Typography>
          {messLoading ? (
            <CircularProgress />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Breakfast</TableCell>
                    <TableCell>Lunch</TableCell>
                    <TableCell>Dinner</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {messMenus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell>{menu.date}</TableCell>
                      <TableCell>{menu.breakfast || '-'}</TableCell>
                      <TableCell>{menu.lunch || '-'}</TableCell>
                      <TableCell>{menu.dinner || '-'}</TableCell>
                      <TableCell>{menu.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {messMenus.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No menu available.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Your Requests</Typography>
        {requestsLoading ? (
          <CircularProgress />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Room</TableCell>
                  <TableCell>Hostel</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Requested On</TableCell>
                  <TableCell>Note</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.room_number}</TableCell>
                    <TableCell>{req.hostel_name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={req.status}
                        color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>{req.requested_on?.slice(0, 10) || '-'}</TableCell>
                    <TableCell>{req.note || '-'}</TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No requests yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={occupantOpen} onClose={() => setOccupantOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Room {selectedRoom?.room_number || ''} Occupants
        </DialogTitle>
        <DialogContent>
          {selectedOccupants.length === 0 ? (
            <Typography color="text.secondary">No occupants listed.</Typography>
          ) : (
            <Stack spacing={2}>
              {selectedOccupants.map((occupant) => (
                <Box key={occupant.id} display="flex" alignItems="center" gap={2}>
                  <Avatar src={getAvatarUrl(occupant)} />
                  <Box>
                    <Typography variant="subtitle1">{occupant.student_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {occupant.student_id} • {occupant.student_class} {occupant.student_section}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOccupantOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Hostel;

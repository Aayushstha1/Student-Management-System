import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
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
  Switch,
  FormControlLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import {
  Home as HomeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MeetingRoom as RoomIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const HostelManagement = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const isReadOnly = true;

  const { data: hostelsData, isLoading: hostelsLoading } = useQuery({
    queryKey: ['hostels'],
    queryFn: async () => (await axios.get('/hostel/')).data,
  });

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['hostel-rooms'],
    queryFn: async () => (await axios.get('/hostel/rooms/')).data,
  });

  const { data: allocationsData, isLoading: allocationsLoading } = useQuery({
    queryKey: ['hostel-allocations'],
    queryFn: async () => (await axios.get('/hostel/allocations/')).data,
  });

  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['hostel-maintenance'],
    queryFn: async () => (await axios.get('/hostel/maintenance/')).data,
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-all'],
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

  const hostels = Array.isArray(hostelsData) ? hostelsData : (hostelsData?.results || []);
  const rooms = Array.isArray(roomsData) ? roomsData : (roomsData?.results || []);
  const allocations = Array.isArray(allocationsData) ? allocationsData : (allocationsData?.results || []);
  const maintenanceRequests = Array.isArray(maintenanceData) ? maintenanceData : (maintenanceData?.results || []);
  const students = Array.isArray(studentsData) ? studentsData : (studentsData || []);

  const stats = useMemo(() => {
    const totalBeds = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
    const occupied = rooms.reduce((sum, r) => sum + (r.current_occupancy || 0), 0);
    const available = Math.max(totalBeds - occupied, 0);
    return {
      totalBeds,
      occupied,
      available,
      activeHostels: hostels.filter((h) => h.is_active).length,
    };
  }, [rooms, hostels]);

  // Hostel form state
  const [hostelDialog, setHostelDialog] = useState(false);
  const [editingHostel, setEditingHostel] = useState(null);
  const [hostelForm, setHostelForm] = useState({
    name: '',
    address: '',
    capacity: 0,
    warden_name: '',
    warden_contact: '',
    is_active: true,
  });

  // Room form state
  const [roomDialog, setRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    hostel: '',
    room_number: '',
    room_type: 'double',
    capacity: 2,
    monthly_rent: '',
    is_active: true,
  });

  // Allocation form state
  const [allocationDialog, setAllocationDialog] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [allocationForm, setAllocationForm] = useState({
    student: '',
    room: '',
    allocated_date: new Date().toISOString().slice(0, 10),
    monthly_rent: '',
    is_active: true,
  });

  const [roomFilterHostel, setRoomFilterHostel] = useState('');
  const [allocationFilterHostel, setAllocationFilterHostel] = useState('');
  const [allocationFilterStatus, setAllocationFilterStatus] = useState('active');
  const [allocationSearch, setAllocationSearch] = useState('');

  useEffect(() => {
    if (!allocationForm.room) return;
    const room = rooms.find((r) => String(r.id) === String(allocationForm.room));
    if (room && (!allocationForm.monthly_rent || allocationForm.monthly_rent === '')) {
      setAllocationForm((prev) => ({ ...prev, monthly_rent: room.monthly_rent }));
    }
  }, [allocationForm.room, rooms, allocationForm.monthly_rent]);

  const createHostel = useMutation({
    mutationFn: async () => axios.post('/hostel/', hostelForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostels']);
      setHostelDialog(false);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to create hostel'),
  });

  const updateHostel = useMutation({
    mutationFn: async () => axios.put(`/hostel/${editingHostel.id}/`, hostelForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostels']);
      setHostelDialog(false);
      setEditingHostel(null);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update hostel'),
  });

  const deleteHostel = useMutation({
    mutationFn: async (id) => axios.delete(`/hostel/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(['hostels']),
  });

  const createRoom = useMutation({
    mutationFn: async () => axios.post('/hostel/rooms/', roomForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-rooms']);
      setRoomDialog(false);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to create room'),
  });

  const updateRoom = useMutation({
    mutationFn: async () => axios.put(`/hostel/rooms/${editingRoom.id}/`, roomForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-rooms']);
      setRoomDialog(false);
      setEditingRoom(null);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update room'),
  });

  const deleteRoom = useMutation({
    mutationFn: async (id) => axios.delete(`/hostel/rooms/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(['hostel-rooms']),
  });

  const createAllocation = useMutation({
    mutationFn: async () => axios.post('/hostel/allocations/', allocationForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-allocations']);
      queryClient.invalidateQueries(['hostel-rooms']);
      queryClient.invalidateQueries(['hostels']);
      setAllocationDialog(false);
    },
    onError: (e) => {
      const data = e.response?.data;
      const msg = data?.detail || (typeof data === 'object' ? JSON.stringify(data) : 'Failed to allocate');
      setError(msg);
    },
  });

  const updateAllocation = useMutation({
    mutationFn: async () => axios.put(`/hostel/allocations/${editingAllocation.id}/`, allocationForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-allocations']);
      queryClient.invalidateQueries(['hostel-rooms']);
      queryClient.invalidateQueries(['hostels']);
      setAllocationDialog(false);
      setEditingAllocation(null);
    },
    onError: (e) => {
      const data = e.response?.data;
      const msg = data?.detail || (typeof data === 'object' ? JSON.stringify(data) : 'Failed to update allocation');
      setError(msg);
    },
  });

  const deleteAllocation = useMutation({
    mutationFn: async (id) => axios.delete(`/hostel/allocations/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-allocations']);
      queryClient.invalidateQueries(['hostel-rooms']);
      queryClient.invalidateQueries(['hostels']);
    },
  });

  const checkoutAllocation = useMutation({
    mutationFn: async (allocation) => axios.patch(`/hostel/allocations/${allocation.id}/`, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-allocations']);
      queryClient.invalidateQueries(['hostel-rooms']);
      queryClient.invalidateQueries(['hostels']);
    },
  });

  const filteredRooms = rooms.filter((r) => !roomFilterHostel || String(r.hostel) === String(roomFilterHostel));

  const filteredAllocations = allocations.filter((a) => {
    if (allocationFilterHostel && String(a.hostel_id) !== String(allocationFilterHostel)) return false;
    if (allocationFilterStatus === 'active' && !a.is_active) return false;
    if (allocationFilterStatus === 'inactive' && a.is_active) return false;
    if (allocationSearch) {
      const search = allocationSearch.toLowerCase();
      const label = `${a.student_id || ''} ${a.student_name || ''}`.toLowerCase();
      if (!label.includes(search)) return false;
    }
    return true;
  });

  const openHostelDialog = (hostel = null) => {
    setEditingHostel(hostel);
    setHostelForm(hostel || {
      name: '',
      address: '',
      capacity: 0,
      warden_name: '',
      warden_contact: '',
      is_active: true,
    });
    setHostelDialog(true);
  };

  const openRoomDialog = (room = null) => {
    setEditingRoom(room);
    setRoomForm(room || {
      hostel: '',
      room_number: '',
      room_type: 'double',
      capacity: 2,
      monthly_rent: '',
      is_active: true,
    });
    setRoomDialog(true);
  };

  const openAllocationDialog = (allocation = null) => {
    setEditingAllocation(allocation);
    setAllocationForm(allocation || {
      student: '',
      room: '',
      allocated_date: new Date().toISOString().slice(0, 10),
      monthly_rent: '',
      is_active: true,
    });
    setAllocationDialog(true);
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <HomeIcon sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4">Hostel Management</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>Rooms, allocations, and occupancy in one place.</Typography>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {isReadOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Admin view is read-only. Hostel wardens manage hostel records.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Beds', value: stats.totalBeds },
          { label: 'Occupied', value: stats.occupied },
          { label: 'Available', value: stats.available },
          { label: 'Active Hostels', value: stats.activeHostels },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">{card.label}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{card.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Hostels" />
        <Tab label="Rooms" />
        <Tab label="Allocations" />
        <Tab label="Maintenance" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Hostels</Typography>
            {!isReadOnly && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openHostelDialog()}>
                Add Hostel
              </Button>
            )}
          </Box>
          {hostelsLoading ? <CircularProgress /> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Warden</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Occupied</TableCell>
                    <TableCell>Available</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hostels.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>{h.warden_name} ({h.warden_contact})</TableCell>
                      <TableCell>{h.capacity}</TableCell>
                      <TableCell>{h.current_occupancy}</TableCell>
                      <TableCell>{h.available_beds}</TableCell>
                      <TableCell>
                        <Chip label={h.is_active ? 'Active' : 'Inactive'} size="small" color={h.is_active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        ) : (
                          <>
                            <IconButton size="small" onClick={() => openHostelDialog(h)}><EditIcon /></IconButton>
                            <IconButton size="small" color="error" onClick={() => deleteHostel.mutate(h.id)}><DeleteIcon /></IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {hostels.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No hostels found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Rooms</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Hostel</InputLabel>
                <Select
                  label="Hostel"
                  value={roomFilterHostel}
                  onChange={(e) => setRoomFilterHostel(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {hostels.map((h) => (
                    <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {!isReadOnly && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openRoomDialog()}>
                  Add Room
                </Button>
              )}
            </Stack>
          </Box>
          {roomsLoading ? <CircularProgress /> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Room</TableCell>
                    <TableCell>Hostel</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Occupied</TableCell>
                    <TableCell>Available</TableCell>
                    <TableCell>Rent</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRooms.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.room_number}</TableCell>
                      <TableCell>{r.hostel_name}</TableCell>
                      <TableCell>{r.room_type}</TableCell>
                      <TableCell>{r.capacity}</TableCell>
                      <TableCell>{r.current_occupancy}</TableCell>
                      <TableCell>{r.available_beds}</TableCell>
                      <TableCell>{r.monthly_rent}</TableCell>
                      <TableCell>
                        <Chip label={r.is_active ? 'Active' : 'Inactive'} size="small" color={r.is_active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        ) : (
                          <>
                            <IconButton size="small" onClick={() => openRoomDialog(r)}><EditIcon /></IconButton>
                            <IconButton size="small" color="error" onClick={() => deleteRoom.mutate(r.id)}><DeleteIcon /></IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRooms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No rooms found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Allocations</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Hostel</InputLabel>
                <Select
                  label="Hostel"
                  value={allocationFilterHostel}
                  onChange={(e) => setAllocationFilterHostel(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {hostels.map((h) => (
                    <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={allocationFilterStatus}
                  onChange={(e) => setAllocationFilterStatus(e.target.value)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="all">All</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Search student"
                value={allocationSearch}
                onChange={(e) => setAllocationSearch(e.target.value)}
              />
              {!isReadOnly && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openAllocationDialog()}>
                  Allocate Student
                </Button>
              )}
            </Stack>
          </Box>
          {allocationsLoading ? <CircularProgress /> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Hostel</TableCell>
                    <TableCell>Room</TableCell>
                    <TableCell>Allocated</TableCell>
                    <TableCell>Rent</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAllocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.student_name} ({a.student_id})</TableCell>
                      <TableCell>{a.student_class} {a.student_section}</TableCell>
                      <TableCell>{a.hostel_name}</TableCell>
                      <TableCell>{a.room_number}</TableCell>
                      <TableCell>{a.allocated_date}</TableCell>
                      <TableCell>{a.monthly_rent}</TableCell>
                      <TableCell>
                        <Chip label={a.is_active ? 'Active' : 'Inactive'} size="small" color={a.is_active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        ) : (
                          <>
                            <IconButton size="small" onClick={() => openAllocationDialog(a)}><EditIcon /></IconButton>
                            {a.is_active && (
                              <IconButton size="small" color="warning" onClick={() => checkoutAllocation.mutate(a)}>
                                <PersonIcon />
                              </IconButton>
                            )}
                            <IconButton size="small" color="error" onClick={() => deleteAllocation.mutate(a.id)}><DeleteIcon /></IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAllocations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">No allocations found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {tab === 3 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Maintenance Requests</Typography>
          </Box>
          {maintenanceLoading ? <CircularProgress /> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Room</TableCell>
                    <TableCell>Issue</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reported By</TableCell>
                    <TableCell>Reported On</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {maintenanceRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{req.room_number || '-'}</TableCell>
                      <TableCell>{req.issue}</TableCell>
                      <TableCell>
                        <Chip
                          label={req.priority}
                          size="small"
                          color={req.priority === 'high' ? 'error' : req.priority === 'medium' ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(req.status || '').replace('_', ' ')}
                          size="small"
                          color={req.status === 'completed' ? 'success' : req.status === 'in_progress' ? 'info' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        {req.reported_by_name || 'Unknown'}
                        {req.reported_by_student_id ? ` (${req.reported_by_student_id})` : ''}
                      </TableCell>
                      <TableCell>{req.reported_on?.slice(0, 10) || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {maintenanceRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No maintenance requests.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Hostel Dialog */}
      <Dialog open={hostelDialog} onClose={() => setHostelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingHostel ? 'Edit Hostel' : 'Add Hostel'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}><TextField fullWidth label="Hostel Name" value={hostelForm.name} onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Address" value={hostelForm.address} onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Capacity" value={hostelForm.capacity} onChange={(e) => setHostelForm({ ...hostelForm, capacity: Number(e.target.value) })} /></Grid>
            <Grid item xs={6}><FormControlLabel control={<Switch checked={hostelForm.is_active} onChange={(e) => setHostelForm({ ...hostelForm, is_active: e.target.checked })} />} label="Active" /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Warden Name" value={hostelForm.warden_name} onChange={(e) => setHostelForm({ ...hostelForm, warden_name: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Warden Contact" value={hostelForm.warden_contact} onChange={(e) => setHostelForm({ ...hostelForm, warden_contact: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHostelDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => (editingHostel ? updateHostel.mutate() : createHostel.mutate())}>
            {editingHostel ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={roomDialog} onClose={() => setRoomDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Hostel</InputLabel>
                <Select
                  value={roomForm.hostel}
                  label="Hostel"
                  onChange={(e) => setRoomForm({ ...roomForm, hostel: e.target.value })}
                >
                  {hostels.map((h) => (
                    <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField fullWidth label="Room Number" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={roomForm.room_type}
                  label="Type"
                  onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                >
                  <MenuItem value="single">Single</MenuItem>
                  <MenuItem value="double">Double</MenuItem>
                  <MenuItem value="triple">Triple</MenuItem>
                  <MenuItem value="quad">Quad</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Capacity" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Monthly Rent" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({ ...roomForm, monthly_rent: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControlLabel control={<Switch checked={roomForm.is_active} onChange={(e) => setRoomForm({ ...roomForm, is_active: e.target.checked })} />} label="Active" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoomDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => (editingRoom ? updateRoom.mutate() : createRoom.mutate())}>
            {editingRoom ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Allocation Dialog */}
      <Dialog open={allocationDialog} onClose={() => setAllocationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAllocation ? 'Edit Allocation' : 'Allocate Student'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Student</InputLabel>
                <Select
                  value={allocationForm.student}
                  label="Student"
                  onChange={(e) => setAllocationForm({ ...allocationForm, student: e.target.value })}
                >
                  {students.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.user_details?.first_name} {s.user_details?.last_name} ({s.student_id})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Room</InputLabel>
                <Select
                  value={allocationForm.room}
                  label="Room"
                  onChange={(e) => setAllocationForm({ ...allocationForm, room: e.target.value })}
                >
                  {rooms.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.hostel_name} - Room {r.room_number} ({r.available_beds} beds)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField fullWidth type="date" label="Allocated Date" InputLabelProps={{ shrink: true }} value={allocationForm.allocated_date} onChange={(e) => setAllocationForm({ ...allocationForm, allocated_date: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Monthly Rent" value={allocationForm.monthly_rent} onChange={(e) => setAllocationForm({ ...allocationForm, monthly_rent: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControlLabel control={<Switch checked={allocationForm.is_active} onChange={(e) => setAllocationForm({ ...allocationForm, is_active: e.target.checked })} />} label="Active" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllocationDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => (editingAllocation ? updateAllocation.mutate() : createAllocation.mutate())}>
            {editingAllocation ? 'Save' : 'Allocate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HostelManagement;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
  IconButton,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  Home as HomeIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MeetingRoom as RoomIcon,
  Paid as PaidIcon,
  Build as BuildIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Assignment as RequestsIcon,
  EventNote as LeaveIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RequestsInbox from '../requests/RequestsInbox';

const defaultHostelForm = {
  name: '',
  address: '',
  capacity: 0,
  warden_name: '',
  warden_contact: '',
  is_active: true,
};

const defaultRoomForm = {
  hostel: '',
  room_number: '',
  room_type: 'double',
  capacity: 2,
  monthly_rent: '',
  is_active: true,
};

const defaultFeeForm = {
  student: '',
  room: '',
  allocation: '',
  amount: '',
  due_date: new Date().toISOString().slice(0, 10),
  status: 'pending',
  payment_method: '',
  paid_on: '',
};

const defaultMaintenanceForm = {
  room: '',
  issue: '',
  priority: 'medium',
  status: 'pending',
  notes: '',
  resolved_on: '',
};

const HostelWardenDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  const [hostelFilter, setHostelFilter] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState('all');
  const [roomSearch, setRoomSearch] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('all');
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  const [hostelDialog, setHostelDialog] = useState(false);
  const [editingHostel, setEditingHostel] = useState(null);
  const [hostelForm, setHostelForm] = useState(defaultHostelForm);

  const [roomDialog, setRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState(defaultRoomForm);

  const [feeDialog, setFeeDialog] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [feeForm, setFeeForm] = useState(defaultFeeForm);

  const [maintenanceDialog, setMaintenanceDialog] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(defaultMaintenanceForm);

  const [messDialog, setMessDialog] = useState(false);
  const [editingMess, setEditingMess] = useState(null);
  const [messForm, setMessForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    breakfast: '',
    lunch: '',
    dinner: '',
    notes: '',
  });

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

  const { data: feesData, isLoading: feesLoading } = useQuery({
    queryKey: ['hostel-fees'],
    queryFn: async () => (await axios.get('/hostel/fees/')).data,
  });

  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['hostel-maintenance'],
    queryFn: async () => (await axios.get('/hostel/maintenance/')).data,
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['hostel-requests'],
    queryFn: async () => (await axios.get('/hostel/requests/')).data,
  });

  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ['hostel-leave-requests'],
    queryFn: async () => (await axios.get('/hostel/leave-requests/')).data,
  });

  const { data: messData, isLoading: messLoading } = useQuery({
    queryKey: ['hostel-mess-menus'],
    queryFn: async () => (await axios.get('/hostel/mess-menus/')).data,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
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
  const fees = Array.isArray(feesData) ? feesData : (feesData?.results || []);
  const maintenanceRequests = Array.isArray(maintenanceData) ? maintenanceData : (maintenanceData?.results || []);
  const roomRequests = Array.isArray(requestsData) ? requestsData : (requestsData?.results || []);
  const leaveRequests = Array.isArray(leaveData) ? leaveData : (leaveData?.results || []);
  const messMenus = Array.isArray(messData) ? messData : (messData?.results || []);
  const students = Array.isArray(studentsData) ? studentsData : (studentsData || []);

  const stats = useMemo(() => {
    const totalBeds = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
    const occupied = rooms.reduce((sum, r) => sum + (r.current_occupancy || 0), 0);
    const available = Math.max(totalBeds - occupied, 0);
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => (r.current_occupancy || 0) >= (r.capacity || 0)).length;
    const vacantRooms = rooms.filter((r) => (r.current_occupancy || 0) === 0).length;
    const partialRooms = totalRooms - occupiedRooms - vacantRooms;
    return {
      totalBeds,
      occupied,
      available,
      totalRooms,
      occupiedRooms,
      vacantRooms,
      partialRooms,
      occupancyRate: totalBeds ? Math.round((occupied / totalBeds) * 100) : 0,
    };
  }, [rooms]);

  const feeStats = useMemo(() => {
    const paid = fees.filter((f) => f.status === 'paid');
    const pending = fees.filter((f) => f.status === 'pending');
    const overdue = fees.filter((f) => f.status === 'overdue');
    const toNumber = (value) => Number(value || 0);
    const totalCollected = paid.reduce((sum, f) => sum + toNumber(f.amount), 0);
    const pendingTotal = pending.reduce((sum, f) => sum + toNumber(f.amount), 0);
    const overdueTotal = overdue.reduce((sum, f) => sum + toNumber(f.amount), 0);
    const total = totalCollected + pendingTotal + overdueTotal;
    const collectionRate = total ? Math.round((totalCollected / total) * 100) : 0;
    return {
      totalCollected,
      pendingTotal,
      overdueTotal,
      collectionRate,
    };
  }, [fees]);

  const maintenanceStats = useMemo(() => {
    const pending = maintenanceRequests.filter((r) => r.status === 'pending').length;
    const inProgress = maintenanceRequests.filter((r) => r.status === 'in_progress').length;
    const completed = maintenanceRequests.filter((r) => r.status === 'completed').length;
    return { pending, inProgress, completed };
  }, [maintenanceRequests]);

  const allocationByStudentId = useMemo(() => {
    const map = new Map();
    allocations.filter((a) => a.is_active).forEach((a) => {
      map.set(String(a.student), a);
    });
    return map;
  }, [allocations]);

  const formatMoney = (value) => {
    const number = Number(value || 0);
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(number);
  };

  const getRoomStatus = (room) => {
    if (!room.is_active) return 'maintenance';
    if ((room.current_occupancy || 0) === 0) return 'vacant';
    if ((room.current_occupancy || 0) >= (room.capacity || 0)) return 'occupied';
    return 'partial';
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

  const filteredRooms = rooms.filter((room) => {
    if (hostelFilter && String(room.hostel) !== String(hostelFilter)) return false;
    if (roomSearch && !String(room.room_number || '').toLowerCase().includes(roomSearch.toLowerCase())) return false;
    const status = getRoomStatus(room);
    if (roomStatusFilter !== 'all' && status !== roomStatusFilter) return false;
    return true;
  });

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

  const filteredFees = fees.filter((fee) => {
    if (feeStatusFilter !== 'all' && fee.status !== feeStatusFilter) return false;
    return true;
  });

  const filteredMaintenance = maintenanceRequests.filter((req) => {
    if (maintenanceStatusFilter !== 'all' && req.status !== maintenanceStatusFilter) return false;
    return true;
  });

  const filteredStudents = students.filter((student) => {
    if (!studentSearch) return true;
    const search = studentSearch.toLowerCase();
    const name = `${student.user_details?.first_name || ''} ${student.user_details?.last_name || ''}`.toLowerCase();
    const id = `${student.student_id || ''}`.toLowerCase();
    return name.includes(search) || id.includes(search);
  });

  const occupancyByHostel = useMemo(() => {
    return hostels.map((hostel) => {
      const hostelRooms = rooms.filter((room) => String(room.hostel) === String(hostel.id));
      const totalBeds = hostelRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
      const occupied = hostelRooms.reduce((sum, r) => sum + (r.current_occupancy || 0), 0);
      const available = Math.max(totalBeds - occupied, 0);
      const rate = totalBeds ? Math.round((occupied / totalBeds) * 100) : 0;
      return { hostel, totalBeds, occupied, available, rate };
    });
  }, [hostels, rooms]);

  const pendingRoomRequests = roomRequests.filter((req) => req.status === 'pending');
  const pendingLeaveRequests = leaveRequests.filter((req) => req.status === 'pending_warden');

  const openHostelDialog = (hostel = null) => {
    setEditingHostel(hostel);
    if (hostel) {
      setHostelForm({
        name: hostel.name || '',
        address: hostel.address || '',
        capacity: hostel.capacity || 0,
        warden_name: hostel.warden_name || '',
        warden_contact: hostel.warden_contact || '',
        is_active: hostel.is_active,
      });
    } else {
      setHostelForm(defaultHostelForm);
    }
    setHostelDialog(true);
  };

  const openRoomDialog = (room = null) => {
    setEditingRoom(room);
    if (room) {
      setRoomForm({
        hostel: room.hostel || '',
        room_number: room.room_number || '',
        room_type: room.room_type || 'double',
        capacity: room.capacity || 2,
        monthly_rent: room.monthly_rent || '',
        is_active: room.is_active,
      });
    } else {
      setRoomForm(defaultRoomForm);
    }
    setRoomDialog(true);
  };

  const openFeeDialog = (fee = null, presetStudent = null) => {
    setEditingFee(fee);
    if (fee) {
      setFeeForm({
        student: fee.student || '',
        room: fee.room || '',
        allocation: fee.allocation || '',
        amount: fee.amount || '',
        due_date: fee.due_date || new Date().toISOString().slice(0, 10),
        status: fee.status || 'pending',
        payment_method: fee.payment_method || '',
        paid_on: fee.paid_on || '',
      });
    } else {
      setFeeForm({
        ...defaultFeeForm,
        student: presetStudent?.id || '',
      });
    }
    setFeeDialog(true);
  };

  const openMaintenanceDialog = (request = null, presetRoom = null) => {
    setEditingMaintenance(request);
    if (request) {
      setMaintenanceForm({
        room: request.room || '',
        issue: request.issue || '',
        priority: request.priority || 'medium',
        status: request.status || 'pending',
        notes: request.notes || '',
        resolved_on: request.resolved_on || '',
      });
    } else {
      setMaintenanceForm({
        ...defaultMaintenanceForm,
        room: presetRoom?.id || '',
      });
    }
    setMaintenanceDialog(true);
  };

  const openMessDialog = (menu = null) => {
    setEditingMess(menu);
    if (menu) {
      setMessForm({
        date: menu.date || new Date().toISOString().slice(0, 10),
        breakfast: menu.breakfast || '',
        lunch: menu.lunch || '',
        dinner: menu.dinner || '',
        notes: menu.notes || '',
      });
    } else {
      setMessForm({
        date: new Date().toISOString().slice(0, 10),
        breakfast: '',
        lunch: '',
        dinner: '',
        notes: '',
      });
    }
    setMessDialog(true);
  };

  useEffect(() => {
    if (!feeForm.student) return;
    const allocation = allocations.find((a) => String(a.student) === String(feeForm.student) && a.is_active);
    if (!allocation) return;
    setFeeForm((prev) => ({
      ...prev,
      allocation: prev.allocation || allocation.id,
      room: prev.room || allocation.room,
      amount: prev.amount || allocation.monthly_rent || '',
    }));
  }, [feeForm.student, feeForm.allocation, feeForm.room, feeForm.amount, allocations]);

  const buildFeePayload = () => ({
    ...feeForm,
    room: feeForm.room || null,
    allocation: feeForm.allocation || null,
    paid_on: feeForm.paid_on || null,
    payment_method: feeForm.payment_method || '',
  });

  const buildMaintenancePayload = () => ({
    ...maintenanceForm,
    resolved_on: maintenanceForm.resolved_on || null,
  });

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

  const checkoutAllocation = useMutation({
    mutationFn: async (allocation) => axios.patch(`/hostel/allocations/${allocation.id}/`, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-allocations']);
      queryClient.invalidateQueries(['hostel-rooms']);
      queryClient.invalidateQueries(['hostels']);
    },
  });

  const createFee = useMutation({
    mutationFn: async () => axios.post('/hostel/fees/', buildFeePayload()),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-fees']);
      setFeeDialog(false);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to record fee'),
  });

  const updateFee = useMutation({
    mutationFn: async () => axios.put(`/hostel/fees/${editingFee.id}/`, buildFeePayload()),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-fees']);
      setFeeDialog(false);
      setEditingFee(null);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update fee'),
  });

  const deleteFee = useMutation({
    mutationFn: async (id) => axios.delete(`/hostel/fees/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(['hostel-fees']),
  });

  const createMaintenance = useMutation({
    mutationFn: async () => {
      const payload = buildMaintenancePayload();
      if (payload.status === 'completed' && !payload.resolved_on) {
        payload.resolved_on = new Date().toISOString().slice(0, 10);
      }
      return axios.post('/hostel/maintenance/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-maintenance']);
      setMaintenanceDialog(false);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to create request'),
  });

  const updateMaintenance = useMutation({
    mutationFn: async () => {
      const payload = buildMaintenancePayload();
      if (payload.status === 'completed' && !payload.resolved_on) {
        payload.resolved_on = new Date().toISOString().slice(0, 10);
      }
      return axios.put(`/hostel/maintenance/${editingMaintenance.id}/`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-maintenance']);
      setMaintenanceDialog(false);
      setEditingMaintenance(null);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update request'),
  });

  const deleteMaintenance = useMutation({
    mutationFn: async (id) => axios.delete(`/hostel/maintenance/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(['hostel-maintenance']),
  });

  const approveMaintenance = useMutation({
    mutationFn: async (id) => axios.patch(`/hostel/maintenance/${id}/`, { is_approved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-maintenance']);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to approve request'),
  });

  const createMess = useMutation({
    mutationFn: async () => axios.post('/hostel/mess-menus/', messForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-mess-menus']);
      setMessDialog(false);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to save menu'),
  });

  const updateMess = useMutation({
    mutationFn: async () => axios.put(`/hostel/mess-menus/${editingMess.id}/`, messForm),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-mess-menus']);
      setMessDialog(false);
      setEditingMess(null);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update menu'),
  });

  const deleteMess = useMutation({
    mutationFn: async (id) => axios.delete(`/hostel/mess-menus/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(['hostel-mess-menus']),
  });

  const updateRoomRequest = useMutation({
    mutationFn: async ({ id, status, note }) => axios.patch(`/hostel/requests/${id}/`, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-requests']);
      queryClient.invalidateQueries(['hostel-allocations']);
      queryClient.invalidateQueries(['hostel-rooms']);
      queryClient.invalidateQueries(['hostels']);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update request'),
  });

  const approveLeaveRequest = useMutation({
    mutationFn: async ({ id, note }) => axios.patch(`/hostel/leave-requests/${id}/warden-approve/`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-leave-requests']);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to approve leave request'),
  });

  const rejectLeaveRequest = useMutation({
    mutationFn: async ({ id, note }) => axios.patch(`/hostel/leave-requests/${id}/warden-reject/`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries(['hostel-leave-requests']);
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to reject leave request'),
  });

  const mediaBase = (axios.defaults.baseURL || '').replace('/api', '');
  const getAvatarUrl = (student) => {
    const direct = student.profile_picture_url || student.user_details?.profile_picture;
    if (!direct) return '';
    if (direct.startsWith('http')) return direct;
    return `${mediaBase}${direct}`;
  };

  const handleRequestDecision = (request, status) => {
    let note = '';
    if (status === 'rejected') {
      note = window.prompt('Add a rejection note (optional):') || '';
    }
    updateRoomRequest.mutate({ id: request.id, status, note });
  };

  const handleLeaveDecision = (request, action) => {
    let note = '';
    if (action === 'reject') {
      const input = window.prompt('Add a rejection note (optional):');
      if (input === null) return;
      note = input || '';
      rejectLeaveRequest.mutate({ id: request.id, note });
      return;
    }
    const input = window.prompt('Add an approval note (optional):');
    if (input === null) return;
    note = input || '';
    approveLeaveRequest.mutate({ id: request.id, note });
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #0f172a, #1e3a8a)', color: 'white' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <HomeIcon sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h4">Hostel </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
              
              </Typography>
            </Box>
          </Box>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab icon={<AssessmentIcon />} iconPosition="start" label="Dashboard" />
        <Tab icon={<RoomIcon />} iconPosition="start" label="Rooms" />
        <Tab icon={<RequestsIcon />} iconPosition="start" label="Requests" />
        <Tab icon={<PaidIcon />} iconPosition="start" label="Fees" />
        <Tab icon={<BuildIcon />} iconPosition="start" label="Maintenance" />
        <Tab icon={<PeopleIcon />} iconPosition="start" label="Students" />
        <Tab icon={<AssessmentIcon />} iconPosition="start" label="Occupancy" />
        <Tab icon={<PaidIcon />} iconPosition="start" label="Mess" />
        <Tab icon={<LeaveIcon />} iconPosition="start" label="Leave" />
        <Tab icon={<RequestsIcon />} iconPosition="start" label="Service Requests" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Beds', value: stats.totalBeds },
              { label: 'Occupied', value: stats.occupied },
              { label: 'Vacant', value: stats.available },
              { label: 'Occupancy Rate', value: `${stats.occupancyRate}%` },
            ].map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Hostels</Typography>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => openHostelDialog()}>
                    Add Hostel
                  </Button>
                </Box>
                {hostelsLoading ? (
                  <CircularProgress />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Warden</TableCell>
                          <TableCell>Capacity</TableCell>
                          <TableCell>Occupied</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {hostels.map((hostel) => (
                          <TableRow key={hostel.id}>
                            <TableCell>{hostel.name}</TableCell>
                            <TableCell>{hostel.warden_name}</TableCell>
                            <TableCell>{hostel.capacity}</TableCell>
                            <TableCell>{hostel.current_occupancy}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={hostel.is_active ? 'Active' : 'Inactive'}
                                color={hostel.is_active ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" onClick={() => openHostelDialog(hostel)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  if (window.confirm('Delete this hostel?')) {
                                    deleteHostel.mutate(hostel.id);
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        {hostels.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              No hostels found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Quick Actions
                </Typography>
                <Stack spacing={2}>
                  <Button variant="outlined" startIcon={<PaidIcon />} onClick={() => openFeeDialog()}>
                    Record Payment
                  </Button>
                  <Button variant="outlined" startIcon={<BuildIcon />} onClick={() => openMaintenanceDialog()}>
                    New Maintenance Request
                  </Button>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openRoomDialog()}>
                    Add Room
                  </Button>
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Maintenance
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip label={`Pending ${maintenanceStats.pending}`} color="warning" size="small" />
                  <Chip label={`In Progress ${maintenanceStats.inProgress}`} color="info" size="small" />
                  <Chip label={`Completed ${maintenanceStats.completed}`} color="success" size="small" />
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Active Allocations</Typography>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Hostel</InputLabel>
                <Select
                  label="Hostel"
                  value={hostelFilter}
                  onChange={(e) => setHostelFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {hostels.map((h) => (
                    <MenuItem key={h.id} value={h.id}>
                      {h.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            {(allocationsLoading || roomsLoading) ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Hostel</TableCell>
                      <TableCell>Room</TableCell>
                      <TableCell>Allocated</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allocations
                      .filter((a) => a.is_active)
                      .filter((a) => !hostelFilter || String(a.hostel_id) === String(hostelFilter))
                      .map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            {allocation.student_name} ({allocation.student_id})
                          </TableCell>
                          <TableCell>
                            {allocation.student_class} {allocation.student_section}
                          </TableCell>
                          <TableCell>{allocation.hostel_name}</TableCell>
                          <TableCell>{allocation.room_number}</TableCell>
                          <TableCell>{allocation.allocated_date}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => checkoutAllocation.mutate(allocation)}
                            >
                              Check-out
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {allocations.filter((a) => a.is_active).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No active allocations.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
      {tab === 1 && (
        <Box>
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
                    <MenuItem key={h.id} value={h.id}>
                      {h.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={roomStatusFilter}
                  onChange={(e) => setRoomStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="occupied">Occupied</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="vacant">Vacant</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Search room"
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openRoomDialog()}>
                Add Room
              </Button>
            </Stack>
          </Paper>

          {roomsLoading ? (
            <CircularProgress />
          ) : (
            Object.entries(roomsByFloor).map(([floor, floorRooms]) => (
              <Paper key={floor} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  {floor}
                </Typography>
                <Grid container spacing={2}>
                  {floorRooms.map((room) => {
                    const status = getRoomStatus(room);
                    const statusColor = {
                      occupied: '#10b981',
                      vacant: '#e5e7eb',
                      partial: '#fbbf24',
                      maintenance: '#f87171',
                    }[status] || '#e5e7eb';
                    return (
                      <Grid item xs={12} sm={6} md={3} key={room.id}>
                        <Paper
                          sx={{
                            p: 2,
                            backgroundColor: statusColor,
                            color: status === 'vacant' ? '#111827' : '#0f172a'
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6">{room.room_number}</Typography>
                            <RoomIcon fontSize="small" />
                          </Box>
                          <Typography variant="body2">{room.room_type} room</Typography>
                          <Typography variant="caption">
                            {room.current_occupancy || 0}/{room.capacity || 0} occupied
                          </Typography>
                          <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                            <Chip size="small" label={status} />
                            <Chip size="small" label={`Rent ${formatMoney(room.monthly_rent)}`} />
                          </Box>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <IconButton size="small" onClick={() => openRoomDialog(room)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                if (window.confirm('Delete this room?')) {
                                  deleteRoom.mutate(room.id);
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
                {floorRooms.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No rooms here.
                  </Typography>
                )}
              </Paper>
            ))
          )}
        </Box>
      )}
      {tab === 2 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Pending Requests', value: pendingRoomRequests.length },
              { label: 'Approved', value: roomRequests.filter((r) => r.status === 'approved').length },
              { label: 'Rejected', value: roomRequests.filter((r) => r.status === 'rejected').length },
            ].map((card) => (
              <Grid item xs={12} sm={4} key={card.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Room Requests
            </Typography>
            {requestsLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Hostel</TableCell>
                      <TableCell>Room</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Requested On</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roomRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          {req.student_name} ({req.student_id})
                        </TableCell>
                        <TableCell>
                          {req.student_class} {req.student_section}
                        </TableCell>
                        <TableCell>{req.hostel_name}</TableCell>
                        <TableCell>{req.room_number}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={req.status}
                            color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{req.requested_on?.slice(0, 10) || '-'}</TableCell>
                        <TableCell>
                          {req.status === 'pending' ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleRequestDecision(req, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleRequestDecision(req, 'rejected')}
                              >
                                Reject
                              </Button>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {roomRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No room requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
      {tab === 3 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Collected', value: formatMoney(feeStats.totalCollected) },
              { label: 'Pending Payments', value: formatMoney(feeStats.pendingTotal) },
              { label: 'Overdue Payments', value: formatMoney(feeStats.overdueTotal) },
              { label: 'Collection Rate', value: `${feeStats.collectionRate}%` },
            ].map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Fee Records</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={feeStatusFilter}
                    onChange={(e) => setFeeStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="overdue">Overdue</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openFeeDialog()}>
                  Record Payment
                </Button>
              </Stack>
            </Box>
            {feesLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Room</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell>
                          {fee.student_name} ({fee.student_id})
                        </TableCell>
                        <TableCell>{fee.room_number || '-'}</TableCell>
                        <TableCell>{formatMoney(fee.amount)}</TableCell>
                        <TableCell>{fee.due_date}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={fee.status}
                            color={fee.status === 'paid' ? 'success' : fee.status === 'overdue' ? 'error' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{fee.payment_method || '-'}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => openFeeDialog(fee)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              if (window.confirm('Delete this record?')) {
                                deleteFee.mutate(fee.id);
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredFees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No fee records.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
      {tab === 4 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Pending', value: maintenanceStats.pending },
              { label: 'In Progress', value: maintenanceStats.inProgress },
              { label: 'Completed', value: maintenanceStats.completed },
            ].map((card) => (
              <Grid item xs={12} sm={4} key={card.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Maintenance Requests</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={maintenanceStatusFilter}
                    onChange={(e) => setMaintenanceStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openMaintenanceDialog()}>
                  New Request
                </Button>
              </Stack>
            </Box>
            {maintenanceLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Room</TableCell>
                      <TableCell>Issue</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reported By</TableCell>
                      <TableCell>Approved</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMaintenance.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>{req.room_number}</TableCell>
                        <TableCell>{req.issue}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={req.priority}
                            color={req.priority === 'high' ? 'error' : req.priority === 'medium' ? 'warning' : 'success'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={req.status.replace('_', ' ')}
                            color={req.status === 'completed' ? 'success' : req.status === 'in_progress' ? 'info' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>
                          {req.reported_by_name || 'Unknown'}
                          {req.reported_by_student_id ? ` (${req.reported_by_student_id})` : ''}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={req.is_approved ? 'Approved' : 'Pending'}
                            color={req.is_approved ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => openMaintenanceDialog(req)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {!req.is_approved && (
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ ml: 1 }}
                              onClick={() => approveMaintenance.mutate(req.id)}
                            >
                              Approve
                            </Button>
                          )}
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              if (window.confirm('Delete this request?')) {
                                deleteMaintenance.mutate(req.id);
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredMaintenance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No maintenance requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
      {tab === 5 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <TextField
                size="small"
                placeholder="Search student name or ID"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Paper>

          {studentsLoading ? (
            <CircularProgress />
          ) : (
            <Grid container spacing={2}>
              {filteredStudents.map((student) => {
                const allocation = allocationByStudentId.get(String(student.id));
                const avatarUrl = getAvatarUrl(student);
                return (
                  <Grid item xs={12} sm={6} md={4} key={student.id}>
                    <Paper sx={{ p: 2 }}>
                      <Box display="flex" gap={2} alignItems="center">
                        <Avatar src={avatarUrl} sx={{ width: 56, height: 56 }} />
                        <Box>
                          <Typography variant="subtitle1">
                            {student.user_details?.first_name} {student.user_details?.last_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {student.student_id}
                          </Typography>
                        </Box>
                      </Box>
                      <Box mt={2}>
                        <Typography variant="body2">
                          Class: {student.current_class} {student.current_section}
                        </Typography>
                        <Typography variant="body2">
                          Room: {allocation ? allocation.room_number : 'Not allocated'}
                        </Typography>
                        <Typography variant="body2">
                          Hostel: {allocation ? allocation.hostel_name : '-'}
                        </Typography>
                      </Box>
                      <Box mt={2} display="flex" gap={1}>
                        <Button size="small" variant="text" onClick={() => openFeeDialog(null, student)}>
                          Record Fee
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
              {filteredStudents.length === 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography>No students found.</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      )}
      {tab === 6 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Rooms', value: stats.totalRooms },
              { label: 'Occupied', value: stats.occupiedRooms },
              { label: 'Vacant', value: stats.vacantRooms },
              { label: 'Partial', value: stats.partialRooms },
            ].map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Occupancy by Hostel
            </Typography>
            {occupancyByHostel.length === 0 && <Alert severity="info">No hostels configured yet.</Alert>}
            <Stack spacing={2}>
              {occupancyByHostel.map((item) => (
                <Paper key={item.hostel.id} sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">{item.hostel.name}</Typography>
                    <Typography variant="body2">
                      {item.occupied}/{item.totalBeds} beds
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={item.rate} sx={{ height: 8, borderRadius: 4, mt: 1 }} />
                  <Box display="flex" justifyContent="space-between" mt={1}>
                    <Typography variant="caption">Occupied {item.occupied}</Typography>
                    <Typography variant="caption">Available {item.available}</Typography>
                    <Typography variant="caption">{item.rate}%</Typography>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Box>
      )}
      {tab === 7 && (
        <Box>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Mess / Daily Menu</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openMessDialog()}>
                Add Today's Menu
              </Button>
            </Box>
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
                      <TableCell>Action</TableCell>
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
                        <TableCell>
                          <IconButton size="small" onClick={() => openMessDialog(menu)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              if (window.confirm('Delete this menu?')) {
                                deleteMess.mutate(menu.id);
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {messMenus.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">No menus added yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
      {tab === 8 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Pending Warden', value: pendingLeaveRequests.length },
              { label: 'Pending Parent', value: leaveRequests.filter((r) => r.status === 'pending_parent').length },
              { label: 'Approved', value: leaveRequests.filter((r) => r.status === 'approved').length },
              { label: 'Rejected', value: leaveRequests.filter((r) => r.status === 'rejected').length },
            ].map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Hostel Leave Requests
            </Typography>
            {leaveLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Room</TableCell>
                      <TableCell>Dates</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Warden Note</TableCell>
                      <TableCell>Parent Note</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          {req.student_name} ({req.student_id})
                        </TableCell>
                        <TableCell>
                          {req.student_class} {req.student_section}
                        </TableCell>
                        <TableCell>{req.room_number || '-'}</TableCell>
                        <TableCell>
                          {req.start_date} - {req.end_date}
                        </TableCell>
                        <TableCell>{req.reason || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={String(req.status || '').replace('_', ' ')}
                            color={getLeaveStatusColor(req.status)}
                          />
                        </TableCell>
                        <TableCell>{req.warden_note || '-'}</TableCell>
                        <TableCell>{req.parent_note || '-'}</TableCell>
                        <TableCell>
                          {req.status === 'pending_warden' ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleLeaveDecision(req, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleLeaveDecision(req, 'reject')}
                              >
                                Reject
                              </Button>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {leaveRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center">No leave requests.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {tab === 9 && (
        <Box>
          <RequestsInbox title="Service Requests Inbox" />
        </Box>
      )}

      {/* Hostel Dialog */}
      <Dialog open={hostelDialog} onClose={() => setHostelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingHostel ? 'Edit Hostel' : 'Add Hostel'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Hostel Name"
                value={hostelForm.name}
                onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={hostelForm.address}
                onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Capacity"
                value={hostelForm.capacity}
                onChange={(e) => setHostelForm({ ...hostelForm, capacity: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={hostelForm.is_active}
                    onChange={(e) => setHostelForm({ ...hostelForm, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Warden Name"
                value={hostelForm.warden_name}
                onChange={(e) => setHostelForm({ ...hostelForm, warden_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Warden Contact"
                value={hostelForm.warden_contact}
                onChange={(e) => setHostelForm({ ...hostelForm, warden_contact: e.target.value })}
              />
            </Grid>
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
                    <MenuItem key={h.id} value={h.id}>
                      {h.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Room Number"
                value={roomForm.room_number}
                onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
              />
            </Grid>
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
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Capacity"
                value={roomForm.capacity}
                onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Monthly Rent"
                value={roomForm.monthly_rent}
                onChange={(e) => setRoomForm({ ...roomForm, monthly_rent: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={roomForm.is_active}
                    onChange={(e) => setRoomForm({ ...roomForm, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoomDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => (editingRoom ? updateRoom.mutate() : createRoom.mutate())}>
            {editingRoom ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Fee Dialog */}
      <Dialog open={feeDialog} onClose={() => setFeeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFee ? 'Edit Fee Record' : 'Record Payment'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Student</InputLabel>
                <Select
                  value={feeForm.student}
                  label="Student"
                  onChange={(e) => setFeeForm({ ...feeForm, student: e.target.value })}
                >
                  {students.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.user_details?.first_name} {s.user_details?.last_name} ({s.student_id})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Amount"
                value={feeForm.amount}
                onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="date"
                label="Due Date"
                InputLabelProps={{ shrink: true }}
                value={feeForm.due_date}
                onChange={(e) => setFeeForm({ ...feeForm, due_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={feeForm.status}
                  label="Status"
                  onChange={(e) => setFeeForm({ ...feeForm, status: e.target.value })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={feeForm.payment_method}
                  label="Payment Method"
                  onChange={(e) => setFeeForm({ ...feeForm, payment_method: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Paid On"
                InputLabelProps={{ shrink: true }}
                value={feeForm.paid_on}
                onChange={(e) => setFeeForm({ ...feeForm, paid_on: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => (editingFee ? updateFee.mutate() : createFee.mutate())}>
            {editingFee ? 'Save' : 'Record'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Maintenance Dialog */}
      <Dialog open={maintenanceDialog} onClose={() => setMaintenanceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMaintenance ? 'Edit Maintenance' : 'New Maintenance Request'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Room</InputLabel>
                <Select
                  value={maintenanceForm.room}
                  label="Room"
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, room: e.target.value })}
                >
                  {rooms.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.hostel_name} - Room {r.room_number}
                    </MenuItem>
                  ))}
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
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={maintenanceForm.priority}
                  label="Priority"
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={maintenanceForm.status}
                  label="Status"
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={maintenanceForm.notes}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Resolved On"
                InputLabelProps={{ shrink: true }}
                value={maintenanceForm.resolved_on}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, resolved_on: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintenanceDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => (editingMaintenance ? updateMaintenance.mutate() : createMaintenance.mutate())}
          >
            {editingMaintenance ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mess Menu Dialog */}
      <Dialog open={messDialog} onClose={() => setMessDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMess ? 'Edit Menu' : 'Add Menu'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                InputLabelProps={{ shrink: true }}
                value={messForm.date}
                onChange={(e) => setMessForm({ ...messForm, date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Breakfast"
                value={messForm.breakfast}
                onChange={(e) => setMessForm({ ...messForm, breakfast: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Lunch"
                value={messForm.lunch}
                onChange={(e) => setMessForm({ ...messForm, lunch: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Dinner"
                value={messForm.dinner}
                onChange={(e) => setMessForm({ ...messForm, dinner: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={messForm.notes}
                onChange={(e) => setMessForm({ ...messForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => (editingMess ? updateMess.mutate() : createMess.mutate())}
          >
            {editingMess ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HostelWardenDashboard;

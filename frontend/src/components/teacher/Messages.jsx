import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import axios from 'axios';

const TeacherMessages = () => {
  const [tab, setTab] = useState(0);
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [announceList, setAnnounceList] = useState([]);
  const [announceLoading, setAnnounceLoading] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [newChatError, setNewChatError] = useState('');

  const [announceForm, setAnnounceForm] = useState({ title: '', message: '', target_class: '', target_section: '' });
  const [announceSaving, setAnnounceSaving] = useState(false);
  const [announceError, setAnnounceError] = useState('');

  const loadThreads = async () => {
    try {
      setThreadsLoading(true);
      setThreadsError('');
      const res = await axios.get('/messages/threads/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setThreads(list);
    } catch (err) {
      setThreadsError(err.response?.data?.detail || 'Failed to load chats');
    } finally {
      setThreadsLoading(false);
    }
  };

  const loadMessages = async (threadId) => {
    try {
      setMessagesLoading(true);
      const res = await axios.get(`/messages/threads/${threadId}/messages/`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMessages(list);
    } catch (err) {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setAnnounceLoading(true);
      const res = await axios.get('/messages/announcements/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setAnnounceList(list);
    } catch (err) {
      setAnnounceList([]);
    } finally {
      setAnnounceLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await axios.get('/students/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setStudentList(list);
    } catch (err) {
      setStudentList([]);
    }
  };

  useEffect(() => {
    loadThreads();
    loadAnnouncements();
  }, []);

  const handleSelectThread = (thread) => {
    setSelectedThread(thread);
    loadMessages(thread.id);
  };

  const handleSend = async () => {
    if (!selectedThread || !messageInput.trim()) return;
    try {
      const res = await axios.post(`/messages/threads/${selectedThread.id}/messages/`, {
        content: messageInput.trim(),
      });
      setMessages((prev) => [...prev, res.data]);
      setMessageInput('');
      loadThreads();
    } catch (err) {
      // no-op
    }
  };

  const openNewChat = () => {
    setNewChatError('');
    setSelectedStudent('');
    setNewChatOpen(true);
    loadStudents();
  };

  const createChat = async () => {
    if (!selectedStudent) {
      setNewChatError('Please select a student');
      return;
    }
    try {
      const res = await axios.post('/messages/threads/', { student_id: selectedStudent });
      setNewChatOpen(false);
      await loadThreads();
      handleSelectThread(res.data);
    } catch (err) {
      setNewChatError(err.response?.data?.detail || 'Failed to create chat');
    }
  };

  const saveAnnouncement = async () => {
    if (!announceForm.title || !announceForm.message || !announceForm.target_class) {
      setAnnounceError('Title, message, and class are required');
      return;
    }
    try {
      setAnnounceSaving(true);
      setAnnounceError('');
      await axios.post('/messages/announcements/', announceForm);
      setAnnounceForm({ title: '', message: '', target_class: '', target_section: '' });
      loadAnnouncements();
    } catch (err) {
      setAnnounceError(err.response?.data?.detail || 'Failed to post announcement');
    } finally {
      setAnnounceSaving(false);
    }
  };

  const chatList = useMemo(() => threads || [], [threads]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Messages</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Chats" />
        <Tab label="Announcements" />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 2 }}>
          <Paper sx={{ p: 1, height: '70vh', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">Chats</Typography>
              <Button size="small" onClick={openNewChat}>New</Button>
            </Box>
            {threadsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
            ) : threadsError ? (
              <Alert severity="error">{threadsError}</Alert>
            ) : (
              <List dense>
                {chatList.map((t) => (
                  <ListItem key={t.id} disablePadding>
                    <ListItemButton selected={selectedThread?.id === t.id} onClick={() => handleSelectThread(t)}>
                      <ListItemText
                        primary={t.student_name || 'Student'}
                        secondary={t.last_message?.content || 'No messages yet'}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
                {chatList.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No chats yet." />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>

          <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {selectedThread ? `Chat with ${selectedThread.student_name}` : 'Select a chat'}
            </Typography>
            <Divider />
            <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
              {messagesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (
                messages.map((m) => (
                  <Box key={m.id} sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {m.sender_name} • {new Date(m.created_at).toLocaleString()}
                    </Typography>
                    <Typography variant="body2">{m.content}</Typography>
                  </Box>
                ))
              )}
              {!messagesLoading && selectedThread && messages.length === 0 && (
                <Typography variant="body2" color="text.secondary">No messages yet.</Typography>
              )}
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!selectedThread}
              />
              <Button variant="contained" onClick={handleSend} disabled={!selectedThread || !messageInput.trim()}>
                Send
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Post Announcement</Typography>
            {announceError && <Alert severity="error" sx={{ mb: 2 }}>{announceError}</Alert>}
            <TextField
              fullWidth
              label="Title"
              value={announceForm.title}
              onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Message"
              value={announceForm.message}
              onChange={(e) => setAnnounceForm({ ...announceForm, message: e.target.value })}
              multiline
              rows={4}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Class"
              value={announceForm.target_class}
              onChange={(e) => setAnnounceForm({ ...announceForm, target_class: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Section (optional)"
              value={announceForm.target_section}
              onChange={(e) => setAnnounceForm({ ...announceForm, target_section: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Button variant="contained" onClick={saveAnnouncement} disabled={announceSaving}>
              {announceSaving ? 'Posting...' : 'Post'}
            </Button>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>My Announcements</Typography>
            {announceLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <List>
                {announceList.map((a) => (
                  <ListItem key={a.id} divider>
                    <ListItemText
                      primary={a.title}
                      secondary={`${a.message} • ${a.target_class}${a.target_section ? ` ${a.target_section}` : ''} • ${new Date(a.created_at).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
                {announceList.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No announcements yet." />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>
        </Box>
      )}

      <Dialog open={newChatOpen} onClose={() => setNewChatOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Chat</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {newChatError && <Alert severity="error" sx={{ mb: 2 }}>{newChatError}</Alert>}
          <FormControl fullWidth>
            <InputLabel>Student</InputLabel>
            <Select
              label="Student"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              {studentList.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.user_details?.first_name || ''} {s.user_details?.last_name || ''} ({s.student_id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewChatOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createChat}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeacherMessages;

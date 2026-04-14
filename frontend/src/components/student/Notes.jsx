import React, { useMemo } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Chip, CircularProgress, Alert, Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const Notes = () => {
  const { data: notesData, isLoading, isError } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const res = await axios.get('/notes/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      return list;
    },
  });

  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => (await axios.get('/students/profile/')).data,
  });

  const notes = Array.isArray(notesData) ? notesData : (notesData?.results || []);
  const studentClass = studentProfile?.current_class;
  const userId = studentProfile?.user_id || studentProfile?.user?.id;

  const accessibleNotes = useMemo(() => {
    return notes.filter((note) => {
      const visibility = (note.visibility || 'public').toString().toLowerCase();
      if (visibility === 'public') return true;
      if (visibility === 'class_only') {
        if (!studentClass) return false;
        if (!note.target_class) return true;
        return note.target_class === studentClass;
      }
      if (visibility === 'private') {
        if (!userId) return false;
        return note.uploaded_by === userId;
      }
      // Fallback: show if visibility is unexpected
      return true;
    });
  }, [notes, studentClass, userId]);

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

  const getFileHref = (note) => {
    const filePath = note.attachment_url || note.attachment || note.file_url || note.file;
    if (!filePath) return '';
    if (filePath.startsWith('http')) return filePath;
    const base = (axios.defaults.baseURL || '').replace('/api', '');
    return `${base}${filePath}`;
  };

  const handleOpenNote = (note) => {
    const href = getFileHref(note);
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
    axios.post(`/notes/${note.id}/views/`).catch(() => {
      // Non-blocking: view tracking shouldn't stop the open action
    });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Notes
      </Typography>
      <Paper>
        <List>
          {accessibleNotes.map((n, i) => (
            <ListItem key={n.id || i} divider alignItems="flex-start">
              <ListItemText
                primary={n.title || 'Note'}
                secondary={
                  <>
                    <span>{n.subject_name || n.subject || 'Subject'}</span>
                    {n.category_name && <span>{` • ${n.category_name}`}</span>}
                    {n.updated_at && <span>{` • Updated: ${new Date(n.updated_at).toLocaleDateString()}`}</span>}
                  </>
                }
              />
              {getFileHref(n) ? (
                <Button size="small" variant="outlined" onClick={() => handleOpenNote(n)}>
                  Open
                </Button>
              ) : (
                <Chip label={n.category_name || n.tag || 'File'} />
              )}
            </ListItem>
          ))}
          {accessibleNotes.length === 0 && (
            <ListItem>
              <ListItemText primary="No notes available yet." secondary="Check back later." />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default Notes;



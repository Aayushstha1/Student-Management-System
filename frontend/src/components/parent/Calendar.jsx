import React from 'react';
import { Box, Typography } from '@mui/material';
import CalendarWidget from '../CalendarWidget';

const ParentCalendar = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Academic Calendar
      </Typography>
      <CalendarWidget title="Academic Calendar" eventsUrl="/events/academic/" />
    </Box>
  );
};

export default ParentCalendar;

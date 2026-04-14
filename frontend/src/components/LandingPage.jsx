import React from 'react';
import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { ArrowForward, Apartment, AutoAwesome, Insights, Shield, School } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import './landing.css';

const LandingPage = () => {
  return (
    <Box className="landing-root">
      <Container maxWidth={false} disableGutters className="landing-shell">
        <header className="landing-header">
          <Box className="landing-brand">
            <span className="landing-mark">CS</span>
            <Box>
              <Typography variant="subtitle1" className="landing-title">
                Campus Operations Suite
              </Typography>
              <Typography variant="caption" className="landing-subtitle">
                Admissions - Hostel - Academics
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1.5} className="landing-header-actions">
            <Button component={RouterLink} to="/login" variant="text" className="landing-link">
              Sign In
            </Button>
            <Button component={RouterLink} to="/login" variant="contained" className="landing-cta">
              Get Started
            </Button>
          </Stack>
        </header>

        <main className="landing-hero">
          <Box className="landing-hero-copy">
            <Typography variant="h2" className="landing-headline">
              Run your entire campus from one
              <span className="landing-accent"> command center</span>.
            </Typography>
            <Typography className="landing-body">
              Attendance, hostel, library, results, and parent approvals stay in sync.
              Admins get control, teachers work faster, and students see everything in one place.
            </Typography>
            <Stack direction="row" spacing={2} className="landing-hero-actions">
              <Button component={RouterLink} to="/login" variant="contained" className="landing-cta">
                Enter Portal
                <ArrowForward fontSize="small" />
              </Button>
              <Button component={RouterLink} to="/login" variant="outlined" className="landing-outline">
                Explore Modules
              </Button>
            </Stack>
            <Stack direction="row" spacing={2} className="landing-metrics">
              <Box>
                <Typography className="landing-metric-value">24/7</Typography>
                <Typography className="landing-metric-label">Live occupancy updates</Typography>
              </Box>
              <Divider orientation="vertical" flexItem className="landing-divider" />
              <Box>
                <Typography className="landing-metric-value">3 Roles</Typography>
                <Typography className="landing-metric-label">Admin - Teacher - Student</Typography>
              </Box>
              <Divider orientation="vertical" flexItem className="landing-divider" />
              <Box>
                <Typography className="landing-metric-value">0 Delay</Typography>
                <Typography className="landing-metric-label">Instant approvals</Typography>
              </Box>
            </Stack>
          </Box>

          <Box className="landing-hero-panel">
            <Paper className="landing-card landing-card-primary" elevation={0}>
              <Box className="landing-card-header">
                <Apartment />
                <Typography variant="subtitle1">Hostel Control</Typography>
              </Box>
              <Typography className="landing-card-text">
                Track rooms by floor, approve requests, and see live occupancy in seconds.
              </Typography>
              <Stack direction="row" spacing={1} className="landing-card-badges">
                <Chip label="Vacant: 7" size="small" />
                <Chip label="Partial: 8" size="small" />
                <Chip label="Full: 9" size="small" />
              </Stack>
            </Paper>

            <Paper className="landing-card landing-card-secondary" elevation={0}>
              <Box className="landing-card-header">
                <Insights />
                <Typography variant="subtitle1">Analytics Snapshot</Typography>
              </Box>
              <Typography className="landing-card-text">
                Attendance and results update the moment data is entered.
              </Typography>
              <Stack direction="row" spacing={1} className="landing-card-badges">
                <Chip label="Attendance 92%" size="small" />
              </Stack>
            </Paper>

            <Paper className="landing-card landing-card-tertiary" elevation={0}>
              <Box className="landing-card-header">
                <Shield />
                <Typography variant="subtitle1">Secure Access</Typography>
              </Box>
              <Typography className="landing-card-text">
                Role-based dashboards keep every user focused on the right tasks.
              </Typography>
            </Paper>
          </Box>
        </main>

        <section className="landing-features">
          <Typography variant="h4" className="landing-section-title">
            Everything your campus needs, in one flow
          </Typography>
          <Box className="landing-feature-grid">
            <Paper className="landing-feature" elevation={0}>
              <School />
              <Typography variant="subtitle1">Student self-service</Typography>
              <Typography className="landing-feature-text">
                Room requests, notices, and tasks in one student view.
              </Typography>
            </Paper>
            <Paper className="landing-feature" elevation={0}>
              <Apartment />
              <Typography variant="subtitle1">Hostel operations</Typography>
              <Typography className="landing-feature-text">
                Floor-wise room views, occupancy charts, and maintenance queues.
              </Typography>
            </Paper>
            <Paper className="landing-feature" elevation={0}>
              <Insights />
              <Typography variant="subtitle1">Live reporting</Typography>
              <Typography className="landing-feature-text">
                Attendance and results dashboards that update instantly.
              </Typography>
            </Paper>
          </Box>
        </section>

        <section className="landing-cta-panel">
          <Box>
            <Typography variant="h4" className="landing-section-title">
              Ready to open the portal?
            </Typography>
            <Typography className="landing-body">
              Sign in to continue. Your dashboard will open based on your role.
            </Typography>
          </Box>
          <Button component={RouterLink} to="/login" variant="contained" className="landing-cta">
            Sign In Now
          </Button>
        </section>
      </Container>
    </Box>
  );
};

export default LandingPage;

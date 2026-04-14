import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
  CardActions,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Checkbox,
  Stack,
  Rating,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  WorkOutline,
  School,
  AutoGraph,
  EmojiEvents,
  Language,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const parseList = (value, limit = 8) => {
  if (!value) return [];
  return value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
};

const MetricCard = ({ label, value }) => {
  return (
    <Paper
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.12)',
        color: 'white',
        minWidth: 120,
      }}
      elevation={0}
    >
      <Typography variant="caption" sx={{ letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
};

const SectionCard = ({ icon, title, children }) => {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: '#eef2ff',
            color: '#3730a3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
};

const MyCVs = () => {
  const { user } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [approvedCVs, setApprovedCVs] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(true);
  const [approvedError, setApprovedError] = useState('');
  const [ratingInputs, setRatingInputs] = useState({});

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [projects, setProjects] = useState('');
  const [certifications, setCertifications] = useState('');
  const [languages, setLanguages] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [file, setFile] = useState(null);
  const [projectFile, setProjectFile] = useState(null);
  const [isPrimary, setIsPrimary] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Basics', 'Education & Experience', 'Skills & Projects', 'Additional Details'];

  useEffect(() => {
    fetchCVs();
    fetchApprovedCVs();
  }, []);

  const fetchCVs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const resp = await axios.get(`${API_BASE_URL}/students/cvs/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const results = resp.data.results || resp.data;
      setCvs(results);
    } catch (err) {
      setError('Failed to load CVs');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedCVs = async () => {
    try {
      setApprovedLoading(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const resp = await axios.get(`${API_BASE_URL}/students/cvs/approved/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const results = resp.data.results || resp.data;
      setApprovedCVs(results);
      setApprovedError('');
    } catch (err) {
      setApprovedError('Failed to load approved CVs');
    } finally {
      setApprovedLoading(false);
    }
  };

  const updateRatingInput = (cvId, updates) => {
    setRatingInputs((prev) => ({
      ...prev,
      [cvId]: {
        ...(prev[cvId] || {}),
        ...updates,
      },
    }));
  };

  const handleSubmitRating = async (cvId) => {
    const input = ratingInputs[cvId] || {};
    if (!input.score) {
      setApprovedError('Please select a rating before submitting.');
      return;
    }
    try {
      setApprovedError('');
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/students/cvs/${cvId}/rate/`,
        { score: input.score, comment: input.comment || '' },
        { headers: { Authorization: `Token ${token}` } },
      );
      await fetchApprovedCVs();
    } catch (err) {
      setApprovedError(err.response?.data?.detail || err.response?.data?.error || 'Failed to submit rating');
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleProjectFileChange = (e) => {
    setProjectFile(e.target.files[0]);
  };

  const handleNext = () => {
    if (activeStep === 0 && !title.trim()) {
      setError('Please enter a title');
      return;
    }
    setActiveStep((prevStep) => prevStep + 1);
    setError('');
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('title', title);
      formData.append('summary', summary || '');
      formData.append('education', education || '');
      formData.append('experience', experience || '');
      formData.append('skills', skills || '');
      formData.append('projects', projects || '');
      formData.append('certifications', certifications || '');
      formData.append('languages', languages || '');
      formData.append('hobbies', hobbies || '');
      formData.append('is_primary', isPrimary ? 'true' : 'false');
      if (file) formData.append('file', file);
      if (projectFile) formData.append('project_file', projectFile);

      await axios.post(`${API_BASE_URL}/students/cvs/`, formData, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      resetForm();
      setSuccess('CV submitted successfully. It is pending approval.');
      setTimeout(() => setSuccess(''), 5000);
      fetchCVs();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to create CV');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this CV?')) return;
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/students/cvs/${id}/`, {
        headers: { Authorization: `Token ${token}` },
      });
      setSuccess('CV deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchCVs();
    } catch (err) {
      setError('Failed to delete CV');
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending: { color: 'warning', icon: <PendingIcon />, label: 'Pending' },
      approved: { color: 'success', icon: <CheckCircleIcon />, label: 'Approved' },
      rejected: { color: 'error', icon: <CancelIcon />, label: 'Rejected' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Chip icon={config.icon} label={config.label} color={config.color} size="small" />
    );
  };

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setEducation('');
    setExperience('');
    setSkills('');
    setProjects('');
    setCertifications('');
    setLanguages('');
    setHobbies('');
    setFile(null);
    setProjectFile(null);
    setIsPrimary(false);
    setActiveStep(0);
    setError('');
  };

  const displayName = user?.first_name || user?.last_name
    ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
    : (user?.username || 'Student');
  const displayEmail = user?.email || 'email@example.com';
  const userId = user?.id;

  const skillChips = useMemo(() => parseList(skills), [skills]);
  const projectChips = useMemo(() => parseList(projects), [projects]);
  const certificationChips = useMemo(() => parseList(certifications), [certifications]);
  const languageChips = useMemo(() => parseList(languages), [languages]);

  if (loading && approvedLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f4f6fb', minHeight: '100vh', py: 4, fontFamily: 'var(--cv-body)' }}>
      <Container maxWidth="xl">
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        <Paper
          sx={{
            p: 3.5,
            mb: 3,
            borderRadius: 4,
            color: 'white',
            background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 50%)',
            }}
          />
          <Grid container spacing={2} alignItems="center" sx={{ position: 'relative' }}>
            <Grid item xs={12} md={7}>
              <Typography
                variant="h3"
                sx={{ fontFamily: 'var(--cv-display)', fontWeight: 700 }}
              >
                Business CV Studio
              </Typography>
              <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                Create a leadership-focused CV with strong metrics, executive tone, and modern presentation.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                <Chip label="Executive style" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                <Chip label="ATS-ready" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                <Chip label="Clean layout" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Stack direction="row" spacing={2} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
                <MetricCard label="Skills" value={skillChips.length || '?'} />
                <MetricCard label="Projects" value={projectChips.length || '?'} />
                <MetricCard label="Certs" value={certificationChips.length || '?'} />
              </Stack>
              <Box sx={{ mt: 2, textAlign: { xs: 'left', md: 'right' } }}>
                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  onClick={resetForm}
                  sx={{
                    bgcolor: 'white',
                    color: '#1d4ed8',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#e2e8f0' },
                  }}
                >
                  Start New CV
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <SectionCard icon={<AutoGraph fontSize="small" />} title="CV Builder">
              <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {activeStep === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="CV Title"
                      fullWidth
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Professional Summary"
                      fullWidth
                      multiline
                      rows={4}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Summarize your leadership, achievements, and focus areas."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderStyle: 'dashed',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2">Upload CV file (PDF)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Optional but recommended for formal CVs.
                        </Typography>
                      </Box>
                      <Button variant="contained" component="label" startIcon={<UploadIcon />}>
                        Select File
                        <input hidden type="file" accept="application/pdf" onChange={handleFileChange} />
                      </Button>
                    </Paper>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      {file ? file.name : 'No file selected'}
                    </Typography>
                  </Grid>
                </Grid>
              )}

              {activeStep === 1 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Education"
                      fullWidth
                      multiline
                      rows={6}
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      placeholder="Degree, institution, year, honors, GPA, certifications."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Experience"
                      fullWidth
                      multiline
                      rows={6}
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="Company, role, achievements, and measurable results."
                    />
                  </Grid>
                </Grid>
              )}

              {activeStep === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Skills"
                      fullWidth
                      multiline
                      rows={4}
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="Example: Leadership, Financial Modeling, Sales Strategy, Excel"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Projects"
                      fullWidth
                      multiline
                      rows={6}
                      value={projects}
                      onChange={(e) => setProjects(e.target.value)}
                      placeholder="Key projects, impact, tools used, results."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderStyle: 'dashed',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2">Upload project file</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Optional case study or portfolio document.
                        </Typography>
                      </Box>
                      <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
                        Upload File
                        <input hidden type="file" onChange={handleProjectFileChange} />
                      </Button>
                    </Paper>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      {projectFile ? projectFile.name : 'No file selected'}
                    </Typography>
                  </Grid>
                </Grid>
              )}

              {activeStep === 3 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Certifications"
                      fullWidth
                      multiline
                      rows={4}
                      value={certifications}
                      onChange={(e) => setCertifications(e.target.value)}
                      placeholder="Certifications, awards, professional courses."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Languages"
                      fullWidth
                      multiline
                      rows={2}
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      placeholder="Example: English, Hindi, French"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Interests"
                      fullWidth
                      multiline
                      rows={3}
                      value={hobbies}
                      onChange={(e) => setHobbies(e.target.value)}
                      placeholder="Leadership clubs, volunteering, travel, debate."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isPrimary}
                          onChange={(e) => setIsPrimary(e.target.checked)}
                        />
                      }
                      label="Set as primary CV (after approval)"
                    />
                  </Grid>
                </Grid>
              )}

              <Box display="flex" justifyContent="space-between" mt={3}>
                <Button onClick={handleBack} disabled={activeStep === 0}>
                  Back
                </Button>
                {activeStep < steps.length - 1 ? (
                  <Button onClick={handleNext} variant="contained">
                    Next
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit CV'}
                  </Button>
                )}
              </Box>
            </SectionCard>

            <Box sx={{ mt: 3 }}>
              <SectionCard icon={<WorkOutline fontSize="small" />} title="CV Submissions">
                {cvs.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No CVs found. Create your first CV to get started.
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {cvs.map((cv) => (
                      <Grid item xs={12} md={6} key={cv.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {cv.title}
                              </Typography>
                              {getStatusChip(cv.approval_status)}
                              {cv.is_primary && <Chip label="Primary" color="primary" size="small" />}
                            </Box>
                            {cv.summary && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {cv.summary}
                              </Typography>
                            )}
                            {cv.approval_status === 'rejected' && cv.rejection_reason && (
                              <Alert severity="error" sx={{ mt: 1 }}>
                                <Typography variant="body2">
                                  Rejection: {cv.rejection_reason}
                                </Typography>
                              </Alert>
                            )}
                          </CardContent>
                          <CardActions sx={{ justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {cv.file_url && (
                                <Button
                                  size="small"
                                  href={cv.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<VisibilityIcon />}
                                >
                                  View
                                </Button>
                              )}
                              {cv.file_url && (
                                <Button
                                  size="small"
                                  href={cv.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<DownloadIcon />}
                                >
                                  Download
                                </Button>
                              )}
                              {cv.project_file_url && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  href={cv.project_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Project File
                                </Button>
                              )}
                            </Box>
                            {cv.approval_status !== 'approved' && (
                              <IconButton
                                edge="end"
                                aria-label="delete"
                                onClick={() => handleDelete(cv.id)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            )}
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </SectionCard>
            </Box>

            <Box sx={{ mt: 3 }}>
              <SectionCard icon={<VisibilityIcon fontSize="small" />} title="Approved CV Gallery">
                {approvedLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : approvedError ? (
                  <Alert severity="error">{approvedError}</Alert>
                ) : approvedCVs.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No approved CVs yet.
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {approvedCVs.map((cv) => {
                      const ratingValue = ratingInputs[cv.id]?.score ?? cv.user_rating?.score ?? 0;
                      const ratingComment = ratingInputs[cv.id]?.comment ?? cv.user_rating?.comment ?? '';
                      const canRate = cv.owner_id !== userId;
                      return (
                        <Grid item xs={12} md={6} key={cv.id}>
                          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {cv.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {cv.owner}
                              </Typography>
                              {cv.summary && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  {cv.summary}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                Avg {cv.average_rating ? cv.average_rating.toFixed(1) : 'N/A'} ({cv.ratings_count || 0} ratings)
                              </Typography>
                            </CardContent>
                            <CardActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 2, pb: 2 }}>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {cv.file_url && (
                                  <Button size="small" href={cv.file_url} target="_blank" rel="noopener noreferrer">
                                    View
                                  </Button>
                                )}
                                {cv.file_url && (
                                  <Button size="small" href={cv.file_url} target="_blank" rel="noopener noreferrer">
                                    Download
                                  </Button>
                                )}
                              </Box>
                              {canRate ? (
                                <>
                                  <Rating
                                    value={ratingValue}
                                    onChange={(_, value) => updateRatingInput(cv.id, { score: value })}
                                  />
                                  <TextField
                                    label="Comment (optional)"
                                    size="small"
                                    value={ratingComment}
                                    onChange={(e) => updateRatingInput(cv.id, { comment: e.target.value })}
                                  />
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={() => handleSubmitRating(cv.id)}
                                  >
                                    Submit Rating
                                  </Button>
                                </>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  You cannot rate your own CV.
                                </Typography>
                              )}
                            </CardActions>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </SectionCard>
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default MyCVs;

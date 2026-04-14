import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Grade as ResultsIcon, Delete as DeleteIcon, Send as SendIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const TeacherResults = () => {
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('__unset__');
  const [selectedExams, setSelectedExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [marks, setMarks] = useState({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [openPreview, setOpenPreview] = useState(false);

  const { data: classSubjects, isLoading: classSubjectsLoading } = useQuery({
    queryKey: ['teacher-class-subjects'],
    queryFn: async () => {
      const resp = await axios.get('results/class-subjects/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const resp = await axios.get('results/exams/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const { data: allStudents } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const resp = await axios.get('students/');
      return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
    },
  });

  const classOptions = useMemo(() => {
    const unique = new Set((classSubjects || []).map((c) => c.class_name));
    return Array.from(unique).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (Number.isNaN(numA) || Number.isNaN(numB)) {
        return String(a).localeCompare(String(b));
      }
      return numA - numB;
    });
  }, [classSubjects]);

  const sectionOptions = useMemo(() => {
    if (!selectedClass) return [];
    const unique = new Set(
      (classSubjects || [])
        .filter((c) => c.class_name === selectedClass)
        .map((c) => c.section || '')
    );
    return Array.from(unique).sort((a, b) => String(a).localeCompare(String(b)));
  }, [classSubjects, selectedClass]);

  const sectionSelected = selectedSection !== '__unset__';
  const filteredAssignments = useMemo(() => {
    if (!selectedClass || !sectionSelected) return [];
    return (classSubjects || []).filter(
      (a) => a.class_name === selectedClass && (a.section || '') === (selectedSection || '')
    );
  }, [classSubjects, selectedClass, selectedSection, sectionSelected]);

  const subjectIds = useMemo(() => filteredAssignments.map((a) => a.subject), [filteredAssignments]);
  const filteredExams = useMemo(() => {
    return (exams || []).filter((e) => {
      if (!subjectIds.includes(e.subject)) return false;
      if (!selectedClass || !sectionSelected) return true;
      const examClass = e.class_name || '';
      const examSection = e.section || '';
      if (String(examClass) !== String(selectedClass)) return false;
      if (examSection && String(examSection) !== String(selectedSection || '')) return false;
      return true;
    });
  }, [exams, subjectIds, selectedClass, selectedSection, sectionSelected]);

  const classStudents = useMemo(() => {
    if (!selectedClass || !sectionSelected) return [];
    return (allStudents || []).filter((s) => {
      const section = s.current_section || '';
      return s.current_class === selectedClass && section === (selectedSection || '');
    });
  }, [allStudents, selectedClass, selectedSection, sectionSelected]);

  const selectedExamDetails = (filteredExams || []).filter((e) => selectedExams.includes(e.id));

  const publishMutation = useMutation({
    mutationFn: async (resultsData) => {
      const responses = await Promise.all(resultsData.map((result) => axios.post('results/', result)));
      return responses;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['results']);
      setSuccessMessage(`Marks submitted for ${students.length} students. Pending admin approval.`);
      setStep(0);
      setSelectedClass('');
      setSelectedSection('__unset__');
      setSelectedExams([]);
      setStudents([]);
      setMarks({});
      setSelectedStudentId('');
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to submit results.');
    },
  });

  const handleExamSelection = (examId) => {
    setSelectedExams((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]
    );
  };

  const handleAddStudent = () => {
    if (!selectedStudentId) {
      setError('Please select a student.');
      return;
    }

    if (Object.keys(marks).length !== selectedExams.length) {
      setError('Please enter marks for all selected exams.');
      return;
    }

    const student = classStudents.find((s) => s.id === selectedStudentId);
    setStudents([
      ...students,
      {
        id: student.id,
        name: `${student.user_details?.first_name || ''} ${student.user_details?.last_name || ''}`.trim(),
        marks: { ...marks },
      },
    ]);

    setSelectedStudentId('');
    setMarks({});
    setError('');
  };

  const handleRemoveStudent = (idx) => {
    setStudents(students.filter((_, i) => i !== idx));
  };

  const handlePublish = () => {
    if (students.length === 0) {
      setError('Please add at least one student.');
      return;
    }

    const allResults = [];
    students.forEach((student) => {
      selectedExams.forEach((examId) => {
        allResults.push({
          student: student.id,
          exam: examId,
          marks_obtained: parseInt(student.marks[examId] || 0, 10),
        });
      });
    });

    publishMutation.mutate(allResults);
  };

  const steps = ['Select Class & Subjects', 'Add Student Marks'];
  const noAssignments = !classSubjectsLoading && (classSubjects || []).length === 0;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <ResultsIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Submit Class Results</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Step 1: Select Class & Subjects
          </Typography>

          {noAssignments && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No subjects configured for your class/section. Ask admin to assign subjects.
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Select Class</InputLabel>
                <Select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSection('__unset__');
                    setSelectedExams([]);
                    setStudents([]);
                    setMarks({});
                  }}
                  label="Select Class"
                >
                  {classOptions.map((cls) => (
                    <MenuItem key={cls} value={cls}>
                      Class {cls}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!selectedClass}>
                <InputLabel>Select Section</InputLabel>
                <Select
                  value={selectedSection}
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setSelectedExams([]);
                    setStudents([]);
                    setMarks({});
                  }}
                  label="Select Section"
                >
                  <MenuItem value="__unset__" disabled>
                    Select Section
                  </MenuItem>
                  {sectionOptions.map((sec) => (
                    <MenuItem key={sec || 'none'} value={sec}>
                      {sec || 'All / None'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {selectedClass && sectionSelected && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Subjects for Class {selectedClass}{selectedSection ? ` ${selectedSection}` : ''}
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                  {classSubjectsLoading ? (
                    <Box display="flex" alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                      <CircularProgress size={24} sx={{ mr: 1 }} />
                      <Typography variant="body2">Loading subjects...</Typography>
                    </Box>
                  ) : filteredAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No subjects configured for this class/section. Ask admin to assign subjects.
                    </Typography>
                  ) : (
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {filteredAssignments.map((a) => (
                        <Chip key={a.id} label={`${a.subject_code || ''} ${a.subject_name || ''}`.trim()} />
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>
            )}

            {selectedClass && sectionSelected && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Select Exams for the Subject List
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                  {examsLoading ? (
                    <Box display="flex" alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                      <CircularProgress size={24} sx={{ mr: 1 }} />
                      <Typography variant="body2">Loading exams...</Typography>
                    </Box>
                  ) : filteredExams.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No exams available for the assigned subjects.
                    </Typography>
                  ) : (
                    <FormGroup>
                      {filteredExams.map((exam) => (
                        <FormControlLabel
                          key={exam.id}
                          control={
                            <Checkbox
                              checked={selectedExams.includes(exam.id)}
                              onChange={() => handleExamSelection(exam.id)}
                            />
                          }
                          label={`${exam.subject_name || 'Subject'} (${exam.name || 'Exam'}) - Max: ${exam.total_marks || 0}`}
                        />
                      ))}
                    </FormGroup>
                  )}
                </Paper>
              </Grid>
            )}

            {selectedExams.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Selected Exams ({selectedExams.length}):
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {selectedExamDetails.map((exam) => (
                      <Chip
                        key={exam.id}
                        label={`${exam.subject_name} (${exam.total_marks} marks)`}
                        color="primary"
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>

          <Button
            variant="contained"
            onClick={() => setStep(1)}
            disabled={!selectedClass || !sectionSelected || selectedExams.length === 0}
            sx={{ mt: 3 }}
            size="large"
          >
            Continue to Add Marks
          </Button>
        </Paper>
      )}

      {step === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Step 2: Add Student Marks
            </Typography>

            <Card sx={{ mb: 3, bgcolor: 'action.hover' }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Enter Student Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Student</InputLabel>
                      <Select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        label="Student"
                      >
                        {classStudents
                          .filter((s) => !students.some((st) => st.id === s.id))
                          .map((student) => (
                            <MenuItem key={student.id} value={student.id}>
                              {student.user_details?.first_name} {student.user_details?.last_name} ({student.student_id})
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {selectedStudentId && (
                  <Box sx={{ mt: 3 }}>
                    {selectedExamDetails.map((exam) => (
                      <TextField
                        key={exam.id}
                        fullWidth
                        label={`${exam.subject_name} (${exam.name}) - Max: ${exam.total_marks}`}
                        type="number"
                        value={marks[exam.id] || ''}
                        onChange={(e) =>
                          setMarks({
                            ...marks,
                            [exam.id]: e.target.value,
                          })
                        }
                        sx={{ mb: 2 }}
                        inputProps={{ max: exam.total_marks, min: 0 }}
                      />
                    ))}

                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleAddStudent}
                      startIcon={<SendIcon />}
                      size="large"
                    >
                      Add Student & Continue
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Paper>

          {students.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Students Added: {students.length} / {classStudents.length}
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.light' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student</TableCell>
                      {selectedExamDetails.map((exam) => (
                        <TableCell key={exam.id} align="center" sx={{ fontWeight: 'bold' }}>
                          {exam.subject_name}
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                        Action
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map((student, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{student.name}</TableCell>
                        {selectedExamDetails.map((exam) => (
                          <TableCell key={exam.id} align="center">
                            {student.marks[exam.id] || '-'}
                          </TableCell>
                        ))}
                        <TableCell align="center">
                          <Button size="small" color="error" onClick={() => handleRemoveStudent(idx)}>
                            <DeleteIcon fontSize="small" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Box display="flex" gap={2}>
            <Button variant="outlined" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => setOpenPreview(true)}
              disabled={students.length === 0}
              size="large"
            >
              Preview & Submit for Approval
            </Button>
          </Box>
        </Box>
      )}

      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm & Submit for Approval</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Class:</strong> {selectedClass}{selectedSection ? ` ${selectedSection}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Subjects/Exams:</strong> {selectedExamDetails.length}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Students:</strong> {students.length}
            </Typography>
            <Alert severity="info">
              These results will be sent to the admin for approval. Students will see them after approval.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPreview(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setOpenPreview(false);
              handlePublish();
            }}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? <CircularProgress size={24} /> : 'Submit for Approval'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeacherResults;

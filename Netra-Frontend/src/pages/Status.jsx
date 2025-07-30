import { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Alert,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';

function Status() {
  const [backendStatus, setBackendStatus] = useState({ loading: true, data: null, error: null });
  const [sfuStatus, setSfuStatus] = useState({ loading: true, data: null, error: null });

  const checkBackend = async () => {
    try {
      const response = await fetch('/api/healthz');
      const data = await response.json();
      setBackendStatus({ loading: false, data, error: null });
    } catch (error) {
      setBackendStatus({ loading: false, data: null, error: error.message });
    }
  };

  const checkSFU = async () => {
    try {
      const response = await fetch('/sfu/health');
      const data = await response.text();
      setSfuStatus({ loading: false, data, error: null });
    } catch (error) {
      setSfuStatus({ loading: false, data: null, error: error.message });
    }
  };

  useEffect(() => {
    checkBackend();
    checkSFU();

    const interval = setInterval(() => {
      checkBackend();
      checkSFU();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    if (status.loading) return <CircularProgress size={20} />;
    if (status.error) return <Error color="error" />;
    return <CheckCircle color="success" />;
  };

  const getStatusColor = (status) => {
    if (status.loading) return 'default';
    if (status.error) return 'error';
    return 'success';
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
          Netra - Live Video Platform
        </Typography>
        <Typography variant="h6" component="h2" gutterBottom align="center" color="text.secondary">
          Service Status Dashboard
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Backend Service"
                avatar={getStatusIcon(backendStatus)}
                action={
                  <Chip
                    label={backendStatus.loading ? 'Checking...' : backendStatus.error ? 'Error' : 'Healthy'}
                    color={getStatusColor(backendStatus)}
                    size="small"
                  />
                }
              />
              <CardContent>
                {backendStatus.loading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2">Checking backend status...</Typography>
                  </Box>
                )}
                {backendStatus.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {backendStatus.error}
                  </Alert>
                )}
                {backendStatus.data && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    Backend is healthy: {JSON.stringify(backendStatus.data)}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="SFU Service"
                avatar={getStatusIcon(sfuStatus)}
                action={
                  <Chip
                    label={sfuStatus.loading ? 'Checking...' : sfuStatus.error ? 'Error' : 'Healthy'}
                    color={getStatusColor(sfuStatus)}
                    size="small"
                  />
                }
              />
              <CardContent>
                {sfuStatus.loading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2">Checking SFU status...</Typography>
                  </Box>
                )}
                {sfuStatus.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {sfuStatus.error}
                  </Alert>
                )}
                {sfuStatus.data && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    SFU is healthy: {sfuStatus.data}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Sign In:</strong> Access your account and start streaming
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Sign Up:</strong> Create a new account to get started
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Gallery:</strong> View your recorded videos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Stream:</strong> Start a live video stream
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}

export default Status; 
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Breadcrumbs,
  Link as MuiLink,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import { BatchService } from '../services/BatchService';
import { formatDistance, format } from 'date-fns';
import type { StickerBatchWithId } from '../types/DatabaseTypes';
import { useAuth } from '../contexts/AuthContext';

const BatchManagementPage: React.FC = () => {
  const { userRoles, user } = useAuth();
  const canCreateBatches = userRoles.includes('superadmin') || 
                          userRoles.includes('admin') || 
                          userRoles.some(role => role.includes('canCreateBatches'));
  
  const [batches, setBatches] = useState<StickerBatchWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [creatorFilter, setCreatorFilter] = useState<string>('');
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    generating: 0,
    completed: 0,
    failed: 0
  });
  
  // Load batches
  useEffect(() => {
    fetchBatches();
  }, [statusFilter, creatorFilter]);
  
  const fetchBatches = async (reset: boolean = true) => {
    setLoading(true);
    setError(null);
    
    try {
      // Apply filters
      const options: any = {
        pageSize: 10
      };
      
      if (statusFilter) {
        options.status = statusFilter;
      }
      
      if (creatorFilter === 'mine' && user?.uid) {
        options.createdBy = user.uid;
      }
      
      // If not resetting, use the last document for pagination
      if (!reset && lastDoc) {
        options.startAfterDoc = lastDoc;
      } else {
        // Reset pagination when filters change
        setLastDoc(null);
      }
      
      const result = await BatchService.getBatches(options);
      
      if (reset) {
        setBatches(result.batches);
      } else {
        // Append to existing batches for pagination
        setBatches(prev => [...prev, ...result.batches]);
      }
      
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      
      // Update statistics
      updateStats();
    } catch (err: any) {
      setError(err.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };
  
  // Load more batches for pagination
  const loadMore = () => {
    if (!hasMore || loading) return;
    fetchBatches(false);
  };
  
  // Update statistics from Firestore
  const updateStats = async () => {
    try {
      // Get counts for each status
      const allBatches = await BatchService.getBatches({ pageSize: 1000 });
      
      const stats = {
        total: allBatches.batches.length,
        generating: 0,
        completed: 0,
        failed: 0
      };
      
      // Count batches by status
      allBatches.batches.forEach(batch => {
        if (batch.status === 'generating') stats.generating++;
        else if (batch.status === 'completed') stats.completed++;
        else if (batch.status === 'failed') stats.failed++;
      });
      
      setStats(stats);
    } catch (err) {
      console.error('Error updating stats:', err);
    }
  };
  
  // Helper to format timestamps
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : timestamp;
    return format(date, 'PP');
  };
  
  // Helper to format relative time
  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : timestamp;
    return formatDistance(date, new Date(), { addSuffix: true });
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generating':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };
  
  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      {/* Breadcrumbs navigation */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} to="/">
          Dashboard
        </MuiLink>
        <Typography color="text.primary">QR Codes</Typography>
      </Breadcrumbs>
      
      {/* Header with actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          QR Code Batches
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            onClick={() => fetchBatches()}
            disabled={loading}
          >
            Refresh
          </Button>
          
          {canCreateBatches && (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              component={Link} 
              to="/codes/generate"
            >
              Generate New Batch
            </Button>
          )}
        </Box>
      </Box>
      
      {/* Statistics cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
            <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="text.primary">
                {stats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                Total Batches
                </Typography>
            </CardContent>
            </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
            <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="primary">
                {stats.generating}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                Generating
                </Typography>
            </CardContent>
            </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
            <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="success.main">
                {stats.completed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                Completed
                </Typography>
            </CardContent>
            </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
            <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="error.main">
                {stats.failed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                Failed
                </Typography>
            </CardContent>
            </Card>
        </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth size="small">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="generating">Generating</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                </Select>
            </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth size="small">
                <InputLabel id="creator-filter-label">Creator</InputLabel>
                <Select
                labelId="creator-filter-label"
                value={creatorFilter}
                label="Creator"
                onChange={(e) => setCreatorFilter(e.target.value)}
                >
                <MenuItem value="">All Creators</MenuItem>
                <MenuItem value="mine">My Batches</MenuItem>
                </Select>
            </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ textAlign: 'right' }}>
            <Button
                onClick={() => {
                setStatusFilter('');
                setCreatorFilter('');
                }}
                disabled={!statusFilter && !creatorFilter}
            >
                Clear Filters
            </Button>
            </Grid>
        </Grid>
        </Paper>
      
      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Batch table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Batch Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Prefix</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No batches found
                  </Typography>
                  {canCreateBatches && (
                    <Button 
                      component={Link}
                      to="/codes/generate"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      sx={{ mt: 1 }}
                    >
                      Generate New Batch
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {batch.name}
                    </Typography>
                    {batch.description && (
                      <Typography variant="caption" color="text.secondary">
                        {batch.description.length > 50
                          ? batch.description.substring(0, 50) + '...'
                          : batch.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={batch.status.toUpperCase()} 
                      size="small"
                      color={getStatusColor(batch.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTimestamp(batch.createdAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeTime(batch.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {batch.prefix}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {batch.status === 'generating' ? (
                      <Typography variant="body2">
                        {batch.generatedCount} / {batch.quantity}
                      </Typography>
                    ) : (
                      <Typography variant="body2">
                        {batch.quantity}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton 
                        component={Link} 
                        to={`/codes/batches/${batch.id}`}
                        size="small"
                        color="primary"
                      >
                        <ArrowForwardIcon />
                      </IconButton>
                      
                      {batch.status === 'completed' && (
                        <IconButton 
                          size="small"
                          color="primary"
                          onClick={() => {
                            BatchService.exportCodes(batch.id)
                              .then(result => {
                                const link = document.createElement('a');
                                link.href = result.downloadUrl;
                                link.download = `codes_${batch.id}.csv`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              })
                              .catch(err => {
                                console.error('Error exporting codes:', err);
                                setError('Failed to export codes');
                              });
                          }}
                        >
                          <DownloadIcon />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Load more button */}
      {hasMore && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button 
            onClick={loadMore} 
            disabled={loading}
            variant="outlined"
          >
            {loading ? (
              <CircularProgress size={24} sx={{ mr: 1 }} />
            ) : (
              'Load More'
            )}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default BatchManagementPage;
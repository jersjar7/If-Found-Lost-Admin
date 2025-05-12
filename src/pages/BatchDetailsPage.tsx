import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link as MuiLink,
  Button,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { BatchService } from '../services/BatchService';
import { formatDistance, format } from 'date-fns';
import type { StickerBatchWithId, StickerCodeWithId } from '../types/DatabaseTypes';

const BatchDetailsPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  
  const [batch, setBatch] = useState<StickerBatchWithId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<StickerCodeWithId[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeCounts, setCodeCounts] = useState({
    available: 0,
    assigned: 0,
    disabled: 0,
    total: 0,
  });
  
  // Deletion dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Load batch details
  useEffect(() => {
    const fetchBatch = async () => {
      if (!batchId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const batchData = await BatchService.getBatchById(batchId);
        if (batchData) {
          setBatch(batchData);
          
          // Load code counts
          const counts = await BatchService.getCodeCountsByStatus(batchId);
          setCodeCounts(counts);
          
          // Load sample codes
          await fetchCodes();
        } else {
          setError('Batch not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load batch details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBatch();
  }, [batchId]);
  
  // Fetch sample codes
  const fetchCodes = async () => {
    if (!batchId) return;
    
    setCodesLoading(true);
    try {
      const result = await BatchService.getCodesFromBatch(batchId, {
        pageSize: 10
      });
      setCodes(result.codes);
    } catch (err) {
      console.error('Error fetching codes:', err);
    } finally {
      setCodesLoading(false);
    }
  };
  
  // Handle batch deletion
  const handleDeleteBatch = async () => {
    if (!batchId) return;
    
    setDeleteLoading(true);
    try {
      const result = await BatchService.deleteBatch(batchId);
      if (result.success) {
        // Redirect to batch list
        navigate('/codes/batches');
      } else {
        setError(result.message);
        setDeleteDialogOpen(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete batch');
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  // Handle code export
  const handleExportCodes = async () => {
    if (!batchId) return;
    
    try {
      const result = await BatchService.exportCodes(batchId);
      
      // Create a temporary link and click it to download
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = `codes_${batchId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.message || 'Failed to export codes');
    }
  };
  
  // Helper to format timestamps
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : timestamp;
    return format(date, 'PPpp');
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
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} to="/codes/batches" variant="outlined">
            Back to Batch List
          </Button>
        </Box>
      </Box>
    );
  }
  
  if (!batch) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Batch not found</Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} to="/codes/batches" variant="outlined">
            Back to Batch List
          </Button>
        </Box>
      </Box>
    );
  }
  
  // Calculate progress percentage
  const progressPercentage = batch.status === 'generating'
    ? Math.round((batch.generatedCount / batch.quantity) * 100)
    : batch.status === 'completed'
      ? 100
      : 0;
  
  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      {/* Breadcrumbs navigation */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} to="/">
          Dashboard
        </MuiLink>
        <MuiLink component={Link} to="/codes/batches">
          QR Codes
        </MuiLink>
        <Typography color="text.primary">Batch Details</Typography>
      </Breadcrumbs>
      
      {/* Header with actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {batch.name}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            onClick={handleExportCodes}
          >
            Export Codes
          </Button>
          
          <Button 
            variant="outlined" 
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Batch
          </Button>
        </Box>
      </Box>
      
      {/* Status chip and progress */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Chip 
            label={batch.status.toUpperCase()} 
            color={getStatusColor(batch.status)}
          />
          
          {batch.status === 'generating' && (
            <Typography variant="body2" color="text.secondary">
              Generation in progress...
            </Typography>
          )}
        </Box>
        
        {batch.status === 'generating' && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress 
              variant="determinate" 
              value={progressPercentage} 
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
              {batch.generatedCount} of {batch.quantity} codes generated ({progressPercentage}%)
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Batch details grid */}
      <Grid container spacing={3}>
        {/* Batch information card */}
        <Grid size={{ xs: 12 , md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Batch Information
              </Typography>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Batch ID:</Typography>
                  <Typography variant="body2">{batch.id}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Created:</Typography>
                  <Typography variant="body2">
                    {formatTimestamp(batch.createdAt)} ({formatRelativeTime(batch.createdAt)})
                  </Typography>
                </Box>
                
                {batch.completedAt && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Completed:</Typography>
                    <Typography variant="body2">
                      {formatTimestamp(batch.completedAt)} ({formatRelativeTime(batch.completedAt)})
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Product Type:</Typography>
                  <Typography variant="body2">{batch.productType || 'Not specified'}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Description:</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {batch.description || 'No description'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Code statistics card */}
        <Grid size={{ xs: 12, md: 6 }} >
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Code Statistics
              </Typography>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Format:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {batch.prefix}XXXXX{batch.codeLength > 5 ? '...' : ''}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Code Length:</Typography>
                  <Typography variant="body2">
                    {batch.prefix.length + batch.codeLength} characters
                    ({batch.prefix.length} prefix + {batch.codeLength} random)
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Total Codes:</Typography>
                  <Typography variant="body2">{batch.quantity}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Available:</Typography>
                  <Chip 
                    label={codeCounts.available} 
                    size="small" 
                    color="success" 
                    variant="outlined" 
                  />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Assigned:</Typography>
                  <Chip 
                    label={codeCounts.assigned} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Disabled:</Typography>
                  <Chip 
                    label={codeCounts.disabled} 
                    size="small" 
                    color="error" 
                    variant="outlined" 
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Sample codes */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Sample Codes
        </Typography>
        
        {codesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : codes.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Assigned To</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <Typography fontFamily="monospace">{code.id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={code.status} 
                        size="small" 
                        color={
                          code.status === 'available' ? 'success' :
                          code.status === 'assigned' ? 'primary' :
                          'error'
                        }
                      />
                    </TableCell>
                    <TableCell>{formatRelativeTime(code.createdAt)}</TableCell>
                    <TableCell>{code.assignedTo || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No codes available to display</Alert>
        )}
        
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Button 
            component={Link} 
            to={`/codes/batches/${batchId}/codes`} 
            variant="outlined"
          >
            View All Codes
          </Button>
        </Box>
      </Paper>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            Confirm Deletion
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the batch "{batch.name}" and all its
            associated codes? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteBatch} 
            color="error" 
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchDetailsPage;
// src/pages/BatchGeneratorPage.tsx

import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button,
  Breadcrumbs,
  Link as MuiLink
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BatchCreationForm from '../components/BatchCreationForm';

const BatchGeneratorPage: React.FC = () => {
  const { userRoles } = useAuth();
  const canCreateBatches = userRoles.includes('superadmin') || 
                          userRoles.includes('admin') || 
                          userRoles.some(role => role.includes('canCreateBatches'));

  if (!canCreateBatches) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          QR Code Generator
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography>
            You do not have permission to create QR code batches.
          </Typography>
        </Paper>
      </Box>
    );
  }

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
        <Typography color="text.primary">Generate</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          QR Code Generator
        </Typography>

        <Button 
          variant="outlined" 
          component={Link} 
          to="/codes/batches"
        >
          View All Batches
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="body1" paragraph>
          Create a new batch of unique QR codes for your products. Each code will be stored in the database
          and can be assigned to users.
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          <strong>Note:</strong> Generating large batches may take some time as we ensure each code is unique.
          You'll be automatically redirected to the batch details page once creation begins.
        </Typography>
      </Paper>

      <BatchCreationForm />
    </Box>
  );
};

export default BatchGeneratorPage;
// src/pages/DashboardPage.tsx

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Card, CardContent, Grid, Divider } from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Lock as LockIcon,
  QrCode2 as QrCodeIcon, // Added QR code icon
} from '@mui/icons-material';

const DashboardPage: React.FC = () => {
  const { signOutUser, loading, userRoles } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = userRoles.includes('superadmin');

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/login');
    } catch (err: any) {
      console.error('Sign out failed:', err.message);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        IfFoundLost Admin Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Welcome to the IfFoundLost admin dashboard! From here, you can manage your QR codes, 
        track user accounts, and handle administrative tasks.
      </Typography>
      
      {/* General Features - available to all users */}
      <Box sx={{ my: 4 }}>
        <Typography variant="h5" gutterBottom>
          Features
        </Typography>
        
        <Grid container spacing={3}>
          {/* QR Code Generator Card */}
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 4
            }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  QR Code Generator
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Generate and manage QR code batches for tracking.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<QrCodeIcon />}
                  onClick={() => navigate('/codes/batches')}
                  fullWidth
                >
                  Manage QR Codes
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
      
      {/* Admin Controls - only visible to superadmins */}
      {isSuperAdmin && (
        <Box sx={{ my: 4 }}>
          <Typography variant="h5" gutterBottom>
            Admin Controls
          </Typography>
          
          <Grid container spacing={3}>
            {/* User Management Card */}
            <Grid
              size={{
                xs: 12,
                sm: 6,
                md: 4
              }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    User Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Create and manage admin users for the platform.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PersonAddIcon />}
                    onClick={() => navigate('/admin/create-user')}
                    fullWidth
                  >
                    Create New Admin
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Account Security Card */}
            <Grid
              size={{
                xs: 12,
                sm: 6,
                md: 4
              }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Account Security
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Manage locked accounts and security settings.
                  </Typography>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<LockIcon />}
                    onClick={() => navigate('/admin/locked-accounts')}
                    fullWidth
                  >
                    Manage Locked Accounts
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
      
      <Divider sx={{ my: 4 }} />
      
      {/* Quick Actions */}
      <Box sx={{ mt: 4, textAlign: 'right' }}>
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={handleSignOut} 
          disabled={loading}
        >
          {loading ? 'Logging out...' : 'Log Out'}
        </Button>
      </Box>
    </Box>
  );
};

export default DashboardPage;
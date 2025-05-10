// src/components/AdminUserLockoutsList.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Chip
} from '@mui/material';
import {
  LockOpen as LockOpenIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import type { AccountLockInfo } from '../types/DatabaseTypes';

const AdminUserLockoutsList: React.FC = () => {
  const { userRoles, getLockedAccounts, unlockUserAccount } = useAuth();
  const [lockedAccounts, setLockedAccounts] = useState<AccountLockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  
  const isSuperAdmin = userRoles.includes('superadmin');

  // Load locked accounts on component mount
  useEffect(() => {
    fetchLockedAccounts();
  }, []);
  
  // Function to fetch locked accounts
  const fetchLockedAccounts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!isSuperAdmin) {
        setError('You do not have permission to view locked accounts');
        setLoading(false);
        return;
      }
      
      const accounts = await getLockedAccounts();
      setLockedAccounts(accounts);
    } catch (err: any) {
      setError('Failed to load locked accounts: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle unlocking an account
  const handleUnlockAccount = async (userId: string, name: string) => {
    setActionInProgress(userId);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await unlockUserAccount(userId);
      
      if (result.success) {
        setSuccess(`Successfully unlocked account for ${name}`);
        // Remove the account from the list
        setLockedAccounts(lockedAccounts.filter(acc => acc.userId !== userId));
      } else {
        setError(`Failed to unlock account: ${result.message}`);
      }
    } catch (err: any) {
      setError('Error unlocking account: ' + (err.message || 'Unknown error'));
    } finally {
      setActionInProgress(null);
    }
  };
  
  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };
  
  // Calculate remaining lock time
  const getRemainingTime = (lockedUntil: Date | null) => {
    if (!lockedUntil) return 'Not locked';
    
    const now = new Date();
    if (lockedUntil <= now) return 'Lock expired';
    
    const diffMs = lockedUntil.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  // If not a super admin, show permission denied
  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You do not have permission to access this page
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Locked User Accounts
        </Typography>
        
        <Button 
          startIcon={<RefreshIcon />}
          onClick={fetchLockedAccounts}
          disabled={loading}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : lockedAccounts.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          There are currently no locked accounts
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Failed Attempts</TableCell>
                <TableCell>Locked Until</TableCell>
                <TableCell>Remaining Time</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lockedAccounts.map((account) => (
                <TableRow key={account.userId}>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <Chip 
                      icon={<WarningIcon />} 
                      label={account.failedAttempts} 
                      color="error" 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{formatDate(account.lockedUntil)}</TableCell>
                  <TableCell>{getRemainingTime(account.lockedUntil)}</TableCell>
                  <TableCell>
                    <IconButton
                      color="primary"
                      onClick={() => handleUnlockAccount(account.userId, account.name)}
                      disabled={actionInProgress === account.userId}
                      aria-label="unlock account"
                    >
                      {actionInProgress === account.userId ? (
                        <CircularProgress size={24} />
                      ) : (
                        <LockOpenIcon />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>
          About Account Lockouts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Accounts are automatically locked after 5 failed login attempts and remain locked for 30 minutes.
          As a superadmin, you can manually unlock accounts using the button in the Actions column.
        </Typography>
      </Box>
    </Box>
  );
};

export default AdminUserLockoutsList;
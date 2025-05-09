// src/components/CreateAdminForm.tsx
import React, { useState } from 'react';
import {
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormGroup,
  FormControlLabel,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { db, firebaseConfig } from '../firebase';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth as getSecondaryAuth,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import type { SelectChangeEvent } from '@mui/material';

// Secondary app for user creation
const secondaryApp =
  !getApps().some(a => a.name === 'SECONDARY')
    ? initializeApp(firebaseConfig, 'SECONDARY')
    : getApps().find(a => a.name === 'SECONDARY')!;
const secondaryAuth = getSecondaryAuth(secondaryApp);

const rolesOptions = ['superadmin', 'admin', 'editor', 'viewer'];
const statusOptions = ['active', 'inactive', 'pending'] as const;

export default function CreateAdminForm() {
  const { user: currentUser } = useAuth();

  // all your form state
  const [name, setName] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [canCreateBatches, setCanCreateBatches] = useState(false);
  const [canExportCodes, setCanExportCodes] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<typeof statusOptions[number]>('pending');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRolesChange = (e: SelectChangeEvent<string[]>) => {
    setAssignedRoles(e.target.value as string[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentUser?.uid) {
      setErrorMsg('You must be signed in to create users.');
      return;
    }
    if (!email || !password || assignedRoles.length === 0) {
      setErrorMsg('Email, password and at least one role are required.');
      return;
    }

    setSubmitting(true);
    try {
      // Create user on secondary auth
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      const newUid = cred.user.uid;

      // Write their profile, merging only new fields
      await setDoc(
        doc(db, 'adminUsers', newUid),
        {
          assignedRoles,
          name,
          profilePictureUrl,
          createdAt: Timestamp.now(),
          lastLogin: Timestamp.now(),
          lastActivity: Timestamp.now(),
          permissions: {
            canCreateBatches,
            canExportCodes,
            canManageUsers,
          },
          contactInfo: { phone, notificationEmail },
          ipWhitelist: ipWhitelist
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          createdBy: currentUser.uid,
          status,
          lastPasswordReset: Timestamp.now(),
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          department,
          notes,
        },
        { merge: true }
      );

      // Sign out secondary so your superadmin stays logged in
      await secondaryAuth.signOut();

      setSuccessMsg(`✅ User created (${email})`);
      // reset form
      setName('');
      setProfilePictureUrl('');
      setEmail('');
      setPassword('');
      setAssignedRoles([]);
      setPhone('');
      setNotificationEmail('');
      setCanCreateBatches(false);
      setCanExportCodes(false);
      setCanManageUsers(false);
      setIpWhitelist('');
      setDepartment('');
      setNotes('');
      setStatus('pending');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxWidth={600} mx="auto" p={2}>
      <Typography variant="h5" gutterBottom>
        Create New Admin / Superadmin
      </Typography>
      {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
      {successMsg && <Alert severity="success">{successMsg}</Alert>}

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <TextField
          label="Name"
          fullWidth
          margin="normal"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Profile Picture */}
        <TextField
          label="Profile Picture URL"
          fullWidth
          margin="normal"
          value={profilePictureUrl}
          onChange={e => setProfilePictureUrl(e.target.value)}
        />

        {/* Email & Password */}
        <TextField
          label="Email"
          type="email"
          required
          fullWidth
          margin="normal"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          required
          fullWidth
          margin="normal"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {/* Roles multi‐select */}
        <FormControl fullWidth margin="normal">
          <InputLabel id="roles-label">Roles</InputLabel>
          <Select
            labelId="roles-label"
            multiple
            value={assignedRoles}
            onChange={handleRolesChange}
            renderValue={vals => (vals as string[]).join(', ')}
          >
            {rolesOptions.map(role => (
              <MenuItem key={role} value={role}>
                <Checkbox checked={assignedRoles.includes(role)} />
                <ListItemText primary={role} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Contact & permissions */}
        <TextField
          label="Phone"
          fullWidth
          margin="normal"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <TextField
          label="Notification Email"
          type="email"
          fullWidth
          margin="normal"
          value={notificationEmail}
          onChange={e => setNotificationEmail(e.target.value)}
        />

        <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                checked={canCreateBatches}
                onChange={e => setCanCreateBatches(e.target.checked)}
              />
            }
            label="Can Create Batches"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={canExportCodes}
                onChange={e => setCanExportCodes(e.target.checked)}
              />
            }
            label="Can Export Codes"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={canManageUsers}
                onChange={e => setCanManageUsers(e.target.checked)}
              />
            }
            label="Can Manage Users"
          />
        </FormGroup>

        {/* Misc fields */}
        <TextField
          label="IP Whitelist (comma-separated)"
          fullWidth
          margin="normal"
          value={ipWhitelist}
          onChange={e => setIpWhitelist(e.target.value)}
        />
        <TextField
          label="Department"
          fullWidth
          margin="normal"
          value={department}
          onChange={e => setDepartment(e.target.value)}
        />
        <TextField
          label="Notes"
          fullWidth
          margin="normal"
          multiline
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {/* Status select */}
        <FormControl fullWidth margin="normal">
          <InputLabel id="status-label">Status</InputLabel>
          <Select
            labelId="status-label"
            value={status}
            onChange={e => setStatus(e.target.value as any)}
          >
            {statusOptions.map(opt => (
              <MenuItem key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Submit */}
        <Box mt={2}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create Admin'}
          </Button>
        </Box>
      </form>
    </Box>
  );
}

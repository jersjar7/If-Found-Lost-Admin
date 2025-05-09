// src/pages/DashboardPage.tsx

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to the IfFoundLost admin dashboard!</p>

      {isSuperAdmin && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => navigate('/admin/create-user')}
            style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
          >
            + Create New Admin
          </button>
        </div>
      )}

      <button onClick={handleSignOut} disabled={loading}>
        {loading ? 'Logging out...' : 'Log Out'}
      </button>
    </div>
  );
};

export default DashboardPage;

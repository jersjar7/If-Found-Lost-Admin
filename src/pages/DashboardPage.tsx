// src/pages/DashboardPage.tsx

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const { signOutUser, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/login'); // Redirect to login page after logout
    } catch (error: any) {
      console.error('Sign out failed:', error.message);
      // Optionally display an error message to the user
    }
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to the IfFoundLost admin dashboard!</p>
      <button onClick={handleSignOut} disabled={loading}>
        {loading ? 'Logging out...' : 'Log Out'}
      </button>
      {/* You can conditionally render content based on userRoles here later */}
    </div>
  );
};

export default DashboardPage;
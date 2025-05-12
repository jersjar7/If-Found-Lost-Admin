// src/routes.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CreateAdminForm from './components/CreateAdminForm';
import AdminUserLockoutsList from './components/AdminUserLockoutsList';
import { useAuth } from './contexts/AuthContext';
import BatchGeneratorPage from './pages/BatchGeneratorPage';
import BatchManagementPage from './pages/BatchManagementPage';
import BatchDetailsPage from './pages/BatchDetailsPage';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userRoles } = useAuth();
  if (!user) {
    return <Navigate to="/login" />;
  }
  const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));
  if (!hasRequiredRole) {
    return <div>Not Authorized. You do not have the necessary permissions to access this page.</div>;
  }
  return children;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      
      {/* Admin creation route - superadmin only */}
      <Route
        path="/admin/create-user"
        element={
          <ProtectedRoute allowedRoles={['superadmin']}>
            <CreateAdminForm />
          </ProtectedRoute>
        }
      />
      
      {/* Account lockout management - superadmin only */}
      <Route
        path="/admin/locked-accounts"
        element={
          <ProtectedRoute allowedRoles={['superadmin']}>
            <AdminUserLockoutsList />
          </ProtectedRoute>
        }
      />
      
      {/* Code Generation routes - requires canCreateBatches permission */}
      <Route
        path="/codes/generate"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
            <BatchGeneratorPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/codes/batches"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'editor', 'viewer']}>
            <BatchManagementPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/codes/batches/:batchId"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'editor', 'viewer']}>
            <BatchDetailsPage />
          </ProtectedRoute>
        }
      />
      
      {/* Dashboard route - accessible to all admin roles */}
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'editor', 'viewer']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      
      {/* Catch-all for not found pages */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
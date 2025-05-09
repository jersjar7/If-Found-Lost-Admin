// src/routes.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CreateAdminForm     from './components/CreateAdminForm';
import { useAuth } from './contexts/AuthContext';

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
      <Route
        path="/admin/create-user"
        element={
          <ProtectedRoute allowedRoles={['superadmin']}>
            <CreateAdminForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'editor', 'viewer']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
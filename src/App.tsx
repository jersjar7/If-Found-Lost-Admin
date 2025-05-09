// src/App.tsx

import React from 'react';
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';

const App: React.FC = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
import React, { createContext, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';
import { getAuth } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';

interface AuthContextValue {
  user: User | null | undefined;
  loading: boolean;
  // Add any other auth-related values or functions here (e.g., login, logout)
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = getAuth();
  const [user, loading, error] = useAuthState(auth);

  useEffect(() => {
    if (error) {
      console.error('Auth error:', error);
      // Optionally display an error message to the user
    }
  }, [error]);

  const value: AuthContextValue = {
    user,
    loading,
    // Add other auth-related values/functions here
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
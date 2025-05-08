// src/contexts/AuthContext.tsx

import React, { createContext, useEffect, useState, useContext } from 'react';
import type { ReactNode } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import type {User} from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';

interface AuthContextValue {
  user: User | null | undefined;
  loading: boolean;
  error: Error | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  // Add any other auth-related values or functions here (e.g., logout)
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, loading, error] = useAuthState(auth);
  const [authError, setAuthError] = useState<Error | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (error) {
      console.error('Auth error:', error);
      setAuthError(error);
    }
  }, [error]);

  const signUp = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const signOutUser = async () => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      await signOut(auth);
    } catch (err: any) {
      setAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const value: AuthContextValue = {
    user,
    loading: loading || authLoading,
    error: error || authError,
    signIn,
    signUp,
    signOutUser,
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
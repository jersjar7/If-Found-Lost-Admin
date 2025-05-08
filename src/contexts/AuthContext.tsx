// src/contexts/AuthContext.tsx

import React, { createContext, useEffect, useState, useContext } from 'react';
import type { ReactNode } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface AuthContextValue {
  user: FirebaseUser | null | undefined;
  loading: boolean;
  error: Error | undefined;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<void>; // Add rememberMe
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  // Add lastActive and resetInactiveTimer if needed for more control
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, loading, error] = useAuthState(auth);
  const [authError, setAuthError] = useState<Error | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(false);
  const [lastActive, setLastActive] = useState<number>(Date.now());
  const navigate = useNavigate();
  const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

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

  useEffect(() => {
    if (error) {
      console.error('Auth error:', error);
      setAuthError(error);
    }
  }, [error]);

  useEffect(() => {
    const resetInactiveTimer = () => {
      setLastActive(Date.now());
    };

    window.addEventListener('mousemove', resetInactiveTimer);
    window.addEventListener('keypress', resetInactiveTimer);

    const checkInactive = () => {
      const now = Date.now();
      const inactiveTime = now - lastActive;
      if (user && inactiveTime > INACTIVE_TIMEOUT) {
        signOutUser();
        navigate('/login'); // Redirect on timeout
      }
    };

    const intervalId = setInterval(checkInactive, 60 * 1000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', resetInactiveTimer);
      window.removeEventListener('keypress', resetInactiveTimer);
      clearInterval(intervalId);
    };
  }, [user, navigate, signOutUser]); // Depend on user to only run when logged in

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

  const signIn = async (email: string, password: string, rememberMe: boolean) => { // Update signIn function
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      await signInWithEmailAndPassword(auth, email, password);
      setLastActive(Date.now()); // Reset timer on login
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
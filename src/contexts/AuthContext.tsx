// src/contexts/AuthContext.tsx

import React, { createContext, useEffect, useState, useContext } from 'react';
import type { ReactNode } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, browserLocalPersistence, onIdTokenChanged, getIdToken, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase'; // Import db
import { doc, updateDoc } from 'firebase/firestore'; // Import Firestore functions
import type { User as FirebaseUser } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface AuthContextValue {
  user: FirebaseUser | null | undefined;
  loading: boolean;
  error: Error | undefined;
  authLoading: boolean;
  authError: Error | undefined;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
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
      if (user?.uid) {
        updateLastActive(user.uid);
      }
    };

    window.addEventListener('mousemove', resetInactiveTimer);
    window.addEventListener('keypress', resetInactiveTimer);

    const checkInactive = () => {
      const now = Date.now();
      const inactiveTime = now - lastActive;
      if (user && inactiveTime > INACTIVE_TIMEOUT) {
        signOutUser();
        navigate('/login');
      }
    };

    const intervalId = setInterval(checkInactive, 60 * 1000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', resetInactiveTimer);
      window.removeEventListener('keypress', resetInactiveTimer);
      clearInterval(intervalId);
    };
  }, [user, navigate, signOutUser, lastActive]); // Added lastActive as dependency

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        const token = await getIdToken(currentUser);
        console.log('ID Token changed:', token.substring(0, 20) + '...');
      } else {
        console.log('User is signed out or token expired.');
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const updateLastActive = async (uid: string) => {
    try {
      const userRef = doc(db, 'adminUsers', uid);
      await updateDoc(userRef, {
        lastActive: new Date(),
      });
    } catch (error: any) {
      console.error('Error updating last active:', error);
    }
  };

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

  const signIn = async (email: string, password: string, rememberMe: boolean) => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user?.uid) {
        setLastActive(Date.now());
        await updateLastActive(userCredential.user.uid);
      }
    } catch (err: any) {
      setAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      await sendPasswordResetEmail(auth, email);
      // Optionally set a success message state here
      console.log('Password reset email sent to:', email);
      // You might want to display a success message to the user in the UI
    } catch (err: any) {
      setAuthError(err);
      console.error('Error sending password reset email:', err);
      // You might want to display an error message to the user in the UI
    } finally {
      setAuthLoading(false);
    }
  };

  const value: AuthContextValue = {
    user,
    loading: loading || authLoading,
    error: error || authError,
    authLoading,
    authError,
    signIn,
    signUp,
    signOutUser,
    forgotPassword,
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
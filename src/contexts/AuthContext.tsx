// src/contexts/AuthContext.tsx

import React, { createContext, useEffect, useState, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  setPersistence, 
  browserSessionPersistence, 
  browserLocalPersistence, 
  onIdTokenChanged, 
  getIdToken, 
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { validatePassword } from '../utils/passwordUtils';
import { UserLockoutService } from '../services/UserLockoutService';
import type { AccountLockInfo } from '../types/DatabaseTypes';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface AuthContextValue {
  user: FirebaseUser | null | undefined;
  loading: boolean;
  error: Error | undefined;
  authLoading: boolean;
  authError: Error | undefined;
  userRoles: string[];
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  signOutUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  unlockUserAccount: (userId: string) => Promise<{ success: boolean; message: string }>;
  getLockedAccounts: () => Promise<AccountLockInfo[]>;
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
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const navigate = useNavigate();
  const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

  useEffect(() => {
    if (user?.uid) {
      fetchUserRoles(user.uid);
    } else {
      setUserRoles([]);
    }
  }, [user]);

  const fetchUserRoles = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'adminUsers', uid));
      if (userDoc.exists()) {
        setUserRoles(userDoc.data()?.assignedRoles || []);
      } else {
        setUserRoles([]);
      }
    } catch (error: any) {
      console.error('Error fetching user roles:', error);
      setUserRoles([]);
    }
  };

  const signOutUser = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      await signOut(auth);
      setUserRoles([]);
    } catch (err: any) {
      setAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (error) {
      console.error('Auth error:', error);
      setAuthError(error);
    }
  }, [error]);

  // Debounced function to update lastActive - will only fire once per minute max
  const debouncedUpdateLastActive = useCallback(
    debounce((uid: string) => {
      updateLastActive(uid).catch(err => 
        console.error('Error in debounced updateLastActive:', err)
      );
    }, 60000), // 1 minute debounce
    []
  );

  useEffect(() => {
    const resetInactiveTimer = () => {
      setLastActive(Date.now());
      if (user?.uid) {
        debouncedUpdateLastActive(user.uid);
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
  }, [user, navigate, signOutUser, lastActive, debouncedUpdateLastActive]);

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
  }, []);

  async function updateLastActive(uid: string) {
    try {
      const userRef = doc(db, 'adminUsers', uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        // Document exists, update lastActivity using updateDoc
        await updateDoc(userRef, { 
          lastActivity: serverTimestamp() 
        });
      } else {
        console.warn(`User document for uid ${uid} doesn't exist in adminUsers collection`);
        // Don't create a document here - only superadmins can create admin documents
        // according to your security rules
      }
    } catch (error) {
      console.error('Error updating lastActivity:', error);
      // Let the error propagate so the debounced function can log it
      throw error;
    }
  }

  const signIn = async (
    email: string,
    password: string,
    rememberMe: boolean
  ): Promise<void> => {
    setAuthLoading(true);
    setAuthError(undefined);
  
    try {
      // 1) Set persistence
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);
  
      // 2) Prepare our typed callable
      const functions = getFunctions();
      const handleLoginAttemptFn = httpsCallable<
        { email: string; success: boolean },
        { success: boolean; locked?: boolean; message: string }
      >(functions, 'handleLoginAttempt');
  
      try {
        // 3) Attempt Firebase Auth sign-in
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
  
        // 4) On success, notify Cloud Function (and re-enable if needed)
        await handleLoginAttemptFn({ email, success: true });
  
        // 5) Continue your normal flow
        setLastActive(Date.now());
        await fetchUserRoles(userCredential.user.uid);
  
      } catch (authError: any) {
        // 6) If the account was disabled by the function, surface a lockout message
        if (authError.code === 'auth/user-disabled') {
          throw new Error(
            'Your account has been locked. Please try again later or contact support.'
          );
        }
  
        // 7) Otherwise notify Cloud Function of the failure
        const result = await handleLoginAttemptFn({
          email,
          success: false
        });
        // result.data is now typed { success, locked?, message }
        throw new Error(result.data.message);
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
      console.log('Password reset email sent to:', email);
    } catch (err: any) {
      setAuthError(err);
      console.error('Error sending password reset email:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  /**
 * Changes the user's password with validation
 */
const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  setAuthLoading(true);
  setAuthError(undefined);
  
  try {
    if (!user || !user.email) {
      throw new Error('You must be logged in to change your password');
    }
    
    // Validate new password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    // Re-authenticate with current password
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
    
    // Update lastPasswordReset timestamp
    if (user.uid) {
      await updateDoc(doc(db, 'adminUsers', user.uid), {
        lastPasswordReset: serverTimestamp()
      });
    }
    
    return { 
      success: true, 
      message: 'Password successfully updated' 
    };
  } catch (err: any) {
    let errorMessage = 'Failed to change password';
    
    // Handle specific Firebase auth errors
    if (err.code === 'auth/wrong-password') {
      errorMessage = 'Your current password is incorrect';
    } else if (err.code === 'auth/too-many-requests') {
      errorMessage = 'Too many attempts. Please try again later';
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    setAuthError(new Error(errorMessage));
    return { 
      success: false, 
      message: errorMessage 
    };
  } finally {
    setAuthLoading(false);
  }
};

/**
 * Unlock a user account (admin function)
 */
const unlockUserAccount = async (userId: string): Promise<{ success: boolean; message: string }> => {
  if (!user || !userRoles.includes('superadmin')) {
    return { 
      success: false, 
      message: 'You do not have permission to unlock accounts' 
    };
  }

  try {
    // 1) Look up the user's email in Firestore
    const userRef = doc(db, 'adminUsers', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: 'User not found' };
    }
    const email = userSnap.data().email as string;
    if (!email) {
      return { success: false, message: 'No email on record for this user' };
    }

    // 2) Call your handleLoginAttempt callable with { email, success: true }
    const functions = getFunctions();
    const fn = httpsCallable<{ email: string; success: boolean }, { success: boolean }>(
      functions,
      'handleLoginAttempt'
    );
    const result = await fn({ email, success: true });

    if (result.data.success) {
      return { success: true, message: 'Account unlocked successfully.' };
    } else {
      return { success: false, message: 'Failed to unlock account via Cloud Function.' };
    }
  } catch (err: any) {
    console.error('Error unlocking account:', err);
    return { success: false, message: err.message || 'An error occurred while unlocking.' };
  }
};

/**
 * Get all locked accounts (admin function)
 */
const getLockedAccounts = async () => {
  if (!user || !userRoles.includes('superadmin')) {
    return [];
  }
  
  return await UserLockoutService.getLockedAccounts();
};


const value: AuthContextValue = {
  user,
  loading: loading || authLoading,
  error: error || authError,
  authLoading,
  authError,
  userRoles,
  signIn,
  signOutUser,
  forgotPassword,
  changePassword,
  unlockUserAccount,
  getLockedAccounts,
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
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

  const signIn = async (email: string, password: string, rememberMe: boolean) => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user?.uid) {
        setLastActive(Date.now());
        
        // Check if admin document exists
        const userDocRef = doc(db, 'adminUsers', userCredential.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          // Document exists, update lastActivity
          await updateDoc(userDocRef, { lastActivity: serverTimestamp() });
          await fetchUserRoles(userCredential.user.uid);
        } else {
          console.warn("User doesn't have an admin document. They may not have proper permissions.");
          setUserRoles([]);
        }
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
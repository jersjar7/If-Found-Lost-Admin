// src/services/UserLockoutService.ts

import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    Timestamp, 
    addDoc,
    orderBy,
    limit
  } from 'firebase/firestore';
  import { db } from '../firebase';
  import type { AdminUserWithId, AccountLockInfo, LoginAttempt } from '../types/DatabaseTypes';
  
  /**
   * Lock settings configuration
   */
  export const LOCK_SETTINGS = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCK_DURATION_MINUTES: 30,
    RESET_AFTER_DAYS: 1,
  };
  
  /**
   * Service for managing user account lockouts
   */
  export class UserLockoutService {
    /**
     * Find a user by email
     * @param email Email address to search for
     * @returns User document if found, null otherwise
     */
    static async findUserByEmail(email: string): Promise<AdminUserWithId | null> {
      try {
        const usersQuery = query(
          collection(db, 'adminUsers'),
          where('email', '==', email)
        );
        
        const snapshot = await getDocs(usersQuery);
        
        if (snapshot.empty) {
          return null;
        }
        
        const userDoc = snapshot.docs[0];
        return {
          id: userDoc.id,
          ...userDoc.data(),
        } as AdminUserWithId;
      } catch (error) {
        console.error('Error finding user by email:', error);
        return null;
      }
    }
    
    /**
     * Check if account is locked
     * @param userId User ID to check
     * @returns Lock information if locked, null if not locked
     */
    static async isAccountLocked(userId: string): Promise<{ locked: boolean; remainingMinutes: number } | null> {
      try {
        const userRef = doc(db, 'adminUsers', userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          return null;
        }
        
        const userData = userDoc.data();
        const lockTime = userData.accountLockedUntil;
        
        if (!lockTime) {
          return null;
        }
        
        const now = new Date();
        const lockExpiry = lockTime.toDate();
        
        if (lockExpiry > now) {
          const remainingMinutes = Math.ceil((lockExpiry.getTime() - now.getTime()) / 60000);
          return { locked: true, remainingMinutes };
        }
        
        // Lock expired, clear it
        await updateDoc(userRef, {
          accountLockedUntil: null
        });
        
        return null;
      } catch (error) {
        console.error('Error checking account lock:', error);
        return null;
      }
    }
    
    /**
     * Record a failed login attempt and lock account if needed
     * @param email Email that was used for login
     * @returns Updated lock status
     */
    static async recordFailedAttempt(email: string): Promise<{ locked: boolean; message: string }> {
      try {
        const user = await this.findUserByEmail(email);
        
        // Log the attempt regardless of whether user exists
        await this.logLoginAttempt({
          userId: user?.id || null,
          email,
          timestamp: Timestamp.now(),
          success: false
        });
        
        if (!user) {
          // Don't reveal if user exists or not for security
          return { locked: false, message: 'Invalid email/password combination' };
        }
        
        const userRef = doc(db, 'adminUsers', user.id);
        
        // Get current attempts or default to 0
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const updateData: Record<string, any> = { failedLoginAttempts: attempts };
        
        // Check if we need to lock the account
        if (attempts >= LOCK_SETTINGS.MAX_FAILED_ATTEMPTS) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + LOCK_SETTINGS.LOCK_DURATION_MINUTES);
          
          updateData.accountLockedUntil = Timestamp.fromDate(lockTime);
          
          await updateDoc(userRef, updateData);
          
          return { 
            locked: true, 
            message: `Account locked due to too many failed attempts. Try again in ${LOCK_SETTINGS.LOCK_DURATION_MINUTES} minutes.` 
          };
        }
        
        await updateDoc(userRef, updateData);
        
        const attemptsLeft = LOCK_SETTINGS.MAX_FAILED_ATTEMPTS - attempts;
        return { 
          locked: false, 
          message: `Invalid email/password combination. ${attemptsLeft} attempts remaining before account lock.` 
        };
      } catch (error) {
        console.error('Error recording failed attempt:', error);
        return { locked: false, message: 'An error occurred. Please try again later.' };
      }
    }
    
    /**
     * Record a successful login and reset failed attempts
     * @param userId User ID that logged in successfully
     */
    static async recordSuccessfulLogin(userId: string, email: string): Promise<void> {
      try {
        const userRef = doc(db, 'adminUsers', userId);
        
        await updateDoc(userRef, {
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          lastLogin: Timestamp.now()
        });
        
        // Log the successful attempt
        await this.logLoginAttempt({
          userId,
          email,
          timestamp: Timestamp.now(),
          success: true
        });
      } catch (error) {
        console.error('Error recording successful login:', error);
      }
    }
    
    /**
     * Unlock an account (for admin use)
     * @param userId User ID to unlock
     * @returns Success message
     */
    static async unlockAccount(userId: string): Promise<{ success: boolean; message: string }> {
      try {
        const userRef = doc(db, 'adminUsers', userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          return { success: false, message: 'User not found' };
        }
        
        await updateDoc(userRef, {
          failedLoginAttempts: 0,
          accountLockedUntil: null
        });
        
        return { success: true, message: 'Account unlocked successfully' };
      } catch (error) {
        console.error('Error unlocking account:', error);
        return { success: false, message: 'Failed to unlock account' };
      }
    }
    
    /**
     * Get a list of currently locked accounts
     * @returns Array of locked account information
     */
    static async getLockedAccounts(): Promise<AccountLockInfo[]> {
      try {
        const now = Timestamp.now();
        
        const usersQuery = query(
          collection(db, 'adminUsers'),
          where('accountLockedUntil', '>', now)
        );
        
        const snapshot = await getDocs(usersQuery);
        const lockedAccounts: AccountLockInfo[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          lockedAccounts.push({
            userId: doc.id,
            email: data.email || 'Unknown',
            name: data.name || 'Unknown',
            lockedUntil: data.accountLockedUntil ? data.accountLockedUntil.toDate() : null,
            failedAttempts: data.failedLoginAttempts || 0,
            lastLoginAttempt: data.lastLoginAttempt ? data.lastLoginAttempt.toDate() : null
          });
        });
        
        return lockedAccounts;
      } catch (error) {
        console.error('Error getting locked accounts:', error);
        return [];
      }
    }
  
    /**
     * Log a login attempt to the loginAttempts collection
     * @param attempt Login attempt details
     */
    private static async logLoginAttempt(attempt: LoginAttempt): Promise<void> {
      try {
        // Add user agent if in browser environment
        if (typeof window !== 'undefined' && window.navigator) {
          attempt.userAgent = window.navigator.userAgent;
        }
        
        await addDoc(collection(db, 'loginAttempts'), attempt);
      } catch (error) {
        console.error('Error logging login attempt:', error);
      }
    }
    
    /**
     * Get recent login attempts for a user
     * @param userId User ID to get attempts for
     * @param limit Number of attempts to retrieve
     * @returns Array of login attempts
     */
    static async getRecentLoginAttempts(userId: string, limitCount = 10): Promise<LoginAttempt[]> {
      try {
        const attemptsQuery = query(
          collection(db, 'loginAttempts'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
        
        const snapshot = await getDocs(attemptsQuery);
        const attempts: LoginAttempt[] = [];
        
        snapshot.forEach(doc => {
          attempts.push(doc.data() as LoginAttempt);
        });
        
        return attempts;
      } catch (error) {
        console.error('Error getting login attempts:', error);
        return [];
      }
    }
  }
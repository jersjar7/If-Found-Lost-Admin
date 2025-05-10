// src/types/DatabaseTypes.ts

import { Timestamp } from 'firebase/firestore';

/**
 * Admin user base interface - common fields for all admin users
 */
export interface AdminUser {
  name: string;
  email: string;
  assignedRoles: string[];
  profilePictureUrl?: string;
  createdAt: Timestamp;
  createdBy: string;
  lastLogin: Timestamp | null;
  lastActivity: Timestamp | null;
  lastPasswordReset: Timestamp | null;
  permissions: {
    canCreateBatches: boolean;
    canExportCodes: boolean;
    canManageUsers: boolean;
    [key: string]: boolean;
  };
  contactInfo: {
    phone?: string;
    notificationEmail?: string;
  };
  ipWhitelist?: string[];
  status: 'active' | 'inactive' | 'pending';
  department?: string;
  notes?: string;
  
  // Account security fields
  failedLoginAttempts: number;
  accountLockedUntil: Timestamp | null;
}

/**
 * Admin user with ID field - used when retrieving from Firestore
 */
export interface AdminUserWithId extends AdminUser {
  id: string;
}

/**
 * Account lock information
 */
export interface AccountLockInfo {
  userId: string;
  email: string;
  name: string;
  lockedUntil: Date | null;
  failedAttempts: number;
  lastLoginAttempt: Date | null;
}

/**
 * Login attempt information for tracking
 */
export interface LoginAttempt {
  userId: string | null;
  email: string;
  timestamp: Timestamp;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}
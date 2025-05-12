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

/**
 * Sticker batch status types
 */
export type BatchStatus = 'generating' | 'completed' | 'failed';

/**
 * Sticker code status types
 */
export type CodeStatus = 'available' | 'assigned' | 'disabled';

/**
 * Sticker batch interface for code generation
 */
export interface StickerBatch {
  name: string;
  description: string;
  prefix: string;
  codeLength: number;
  quantity: number;
  status: BatchStatus;
  createdAt: Timestamp;
  createdBy: string;
  completedAt: Timestamp | null;
  generatedCount: number;
  productType?: string;
  manufacturingDetails?: {
    manufacturer?: string;
    productionDate?: Timestamp;
    batchNumber?: string;
    [key: string]: any;
  };
  distributionChannel?: string;
  costData?: {
    costPerUnit?: number;
    currency?: string;
    totalCost?: number;
    [key: string]: any;
  };
  expirationDate?: Timestamp;
}

/**
 * Sticker batch with ID field - used when retrieving from Firestore
 */
export interface StickerBatchWithId extends StickerBatch {
  id: string;
}

/**
 * Sticker code interface for individual QR codes
 */
export interface StickerCode {
  batchId: string;
  status: CodeStatus;
  createdAt: Timestamp;
  assignedAt?: Timestamp;
  assignedTo?: string;
  productType?: string;
  expirationDate?: Timestamp;
}

/**
 * Sticker code with ID (the code itself) - used when retrieving from Firestore
 */
export interface StickerCodeWithId extends StickerCode {
  id: string; // This is the actual code (e.g., "IFL-ABC123")
}
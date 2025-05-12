// src/services/BatchService.ts

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import type { StickerBatchWithId, StickerCodeWithId } from '../types/DatabaseTypes';
import { getIdToken } from 'firebase/auth';

/**
 * Service for managing sticker batches
 */
export class BatchService {
  /**
   * Get all batches with pagination
   * 
   * @param options Filtering and pagination options
   * @returns Array of batch documents and pagination info
   */
  static async getBatches(options: {
    pageSize?: number;
    startAfterDoc?: any;
    status?: string;
    createdBy?: string;
  } = {}): Promise<{
    batches: StickerBatchWithId[];
    hasMore: boolean;
    lastDoc: any;
  }> {
    try {
      const { 
        pageSize = 10, 
        startAfterDoc = null, 
        status, 
        createdBy 
      } = options;
      
      const batchesRef = collection(db, 'stickerBatches');
      let batchQuery = query(
        batchesRef,
        orderBy('createdAt', 'desc')
      );
      
      // Apply filters if provided
      if (status) {
        batchQuery = query(batchQuery, where('status', '==', status));
      }
      
      if (createdBy) {
        batchQuery = query(batchQuery, where('createdBy', '==', createdBy));
      }
      
      // Apply pagination
      if (startAfterDoc) {
        batchQuery = query(batchQuery, startAfter(startAfterDoc));
      }
      
      // Apply limit + 1 to check if there are more results
      batchQuery = query(batchQuery, limit(pageSize + 1));
      
      const snapshot = await getDocs(batchQuery);
      const batches: StickerBatchWithId[] = [];
      
      // Convert results to typed objects
      snapshot.forEach((doc) => {
          // Get the index from docs array
          const index = snapshot.docs.indexOf(doc);
          // Only add up to pageSize items to the results
          if (index < pageSize) {
            batches.push({
              id: doc.id,
              ...doc.data()
            } as StickerBatchWithId);
          }
        });
      
      // Check if there are more results
      const hasMore = snapshot.size > pageSize;
      
      // Get the last document for pagination
      const lastDoc = snapshot.size > 0 
        ? snapshot.docs[Math.min(snapshot.size - 1, pageSize - 1)] 
        : null;
      
      return { batches, hasMore, lastDoc };
    } catch (error) {
      console.error('Error getting batches:', error);
      return { batches: [], hasMore: false, lastDoc: null };
    }
  }
  
  /**
   * Get a batch by ID
   * 
   * @param batchId The batch ID
   * @returns The batch document or null if not found
   */
  static async getBatchById(batchId: string): Promise<StickerBatchWithId | null> {
    try {
      const batchRef = doc(db, 'stickerBatches', batchId);
      const batchDoc = await getDoc(batchRef);
      
      if (!batchDoc.exists()) {
        return null;
      }
      
      return {
        id: batchDoc.id,
        ...batchDoc.data()
      } as StickerBatchWithId;
    } catch (error) {
      console.error('Error getting batch:', error);
      return null;
    }
  }
  
  /**
   * Get codes from a batch with pagination
   * 
   * @param batchId The batch ID
   * @param options Filtering and pagination options
   * @returns Array of code documents and pagination info
   */
  static async getCodesFromBatch(
    batchId: string,
    options: {
      pageSize?: number;
      startAfterDoc?: any;
      status?: string;
    } = {}
  ): Promise<{
    codes: StickerCodeWithId[];
    hasMore: boolean;
    lastDoc: any;
  }> {
    try {
      const { 
        pageSize = 50, 
        startAfterDoc = null, 
        status 
      } = options;
      
      const codesRef = collection(db, 'stickerCodes');
      let codesQuery = query(
        codesRef,
        where('batchId', '==', batchId)
      );
      
      // Apply status filter if provided
      if (status) {
        codesQuery = query(codesQuery, where('status', '==', status));
      }
      
      // Apply pagination
      if (startAfterDoc) {
        codesQuery = query(codesQuery, startAfter(startAfterDoc));
      }
      
      // Apply limit + 1 to check if there are more results
      codesQuery = query(codesQuery, limit(pageSize + 1));
      
      const snapshot = await getDocs(codesQuery);
      const codes: StickerCodeWithId[] = [];
      
      // Convert results to typed objects
      snapshot.forEach((doc) => {
          // Get the index from docs array
          const index = snapshot.docs.indexOf(doc);
          // Only add up to pageSize items to the results
          if (index < pageSize) {
            codes.push({
              id: doc.id,
              ...doc.data()
            } as StickerCodeWithId);
          }
        });
      
      // Check if there are more results
      const hasMore = snapshot.size > pageSize;
      
      // Get the last document for pagination
      const lastDoc = snapshot.size > 0 
        ? snapshot.docs[Math.min(snapshot.size - 1, pageSize - 1)] 
        : null;
      
      return { codes, hasMore, lastDoc };
    } catch (error) {
      console.error('Error getting codes from batch:', error);
      return { codes: [], hasMore: false, lastDoc: null };
    }
  }
  
  /**
 * Export codes from a batch (calls Cloud Function for large exports)
 * 
 * @param batchId The batch ID
 * @param options Export options
 * @returns URL to download the exported file
 */
  static async exportCodes(
    batchId: string,
    options: {
      format?: 'csv' | 'json' | 'excel';
      includeStatus?: boolean;
    } = {}
  ): Promise<{ downloadUrl: string; fileName: string; codeCount: number }> {
    const { format = 'csv', includeStatus = true } = options;

    try {
      // ─── FORCE-REFRESH the Firebase ID token ───────────────────────
      if (auth.currentUser) {
        await getIdToken(auth.currentUser, /* forceRefresh= */ true);
      }
      // ────────────────────────────────────────────────────────────────

      // Use the imported functions instance
      const exportCodesFn = httpsCallable<
        { batchId: string; format: string; includeStatus: boolean },
        { downloadUrl: string; fileName: string; codeCount: number }
      >(functions, 'exportCodes');

      // Call the Cloud Function
      const result = await exportCodesFn({
        batchId,
        format,
        includeStatus,
      });

      return result.data;
    } catch (error: any) {
      console.error('Error exporting codes:', error);
      if (error.details) {
        console.error('Detailed error:', error.details);
      }
      throw new Error(error.message || 'Failed to export codes');
    }
  }
  
  /**
 * Delete a batch and all its codes
 * 
 * @param batchId The batch ID
 * @returns Success status
 */
  static async deleteBatch(
    batchId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if the batch exists
      const batchRef = doc(db, 'stickerBatches', batchId);
      const batchDoc = await getDoc(batchRef);
      if (!batchDoc.exists()) {
        return { success: false, message: 'Batch not found' };
      }

      // Check if batch has any codes
      const codesRef = collection(db, 'stickerCodes');
      const codesQuery = query(
        codesRef,
        where('batchId', '==', batchId),
        limit(1)
      );
      const codesSnapshot = await getDocs(codesQuery);

      if (!codesSnapshot.empty) {
        // ─── FORCE-REFRESH the Firebase ID token ─────────────────────
        if (auth.currentUser) {
          await getIdToken(auth.currentUser, /* forceRefresh= */ true);
        }
        // ─────────────────────────────────────────────────────────────

        // Batch has codes → call the deleteBatch Cloud Function
        const deleteBatchFn = httpsCallable<
          { batchId: string },
          { success: boolean; message: string }
        >(functions, 'deleteBatch');

        const result = await deleteBatchFn({ batchId });
        return result.data;
      } else {
        // No codes → safe to delete directly in Firestore
        await deleteDoc(batchRef);
        return { success: true, message: 'Batch deleted successfully' };
      }
    } catch (error: any) {
      console.error('Error deleting batch:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete batch',
      };
    }
  }
  
  /**
   * Count codes in a batch by status
   * 
   * @param batchId The batch ID
   * @returns Counts of codes by status
   */
  static async getCodeCountsByStatus(batchId: string): Promise<{
    available: number;
    assigned: number;
    disabled: number;
    total: number;
  }> {
    try {
      // For large batches, this may be inefficient
      // In a production environment, consider using a counter or Cloud Function
      const codesRef = collection(db, 'stickerCodes');
      const codesQuery = query(
        codesRef,
        where('batchId', '==', batchId)
      );
      
      const snapshot = await getDocs(codesQuery);
      
      let available = 0;
      let assigned = 0;
      let disabled = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        switch (data.status) {
          case 'available':
            available++;
            break;
          case 'assigned':
            assigned++;
            break;
          case 'disabled':
            disabled++;
            break;
        }
      });
      
      return {
        available,
        assigned,
        disabled,
        total: snapshot.size
      };
    } catch (error) {
      console.error('Error getting code counts:', error);
      return {
        available: 0,
        assigned: 0,
        disabled: 0,
        total: 0
      };
    }
  }
}
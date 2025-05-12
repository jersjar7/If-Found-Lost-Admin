// src/services/CodeGenerationService.ts

import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    getDoc, 
    query, 
    where, 
    Timestamp, 
    writeBatch, 
    increment,
    updateDoc,
    limit 
  } from 'firebase/firestore';
  import { getFunctions, httpsCallable } from 'firebase/functions';
  import { db } from '../firebase';
  import type { 
    StickerBatch, 
    StickerBatchWithId, 
    StickerCode, 
    CodeStatus 
  } from '../types/DatabaseTypes';
  
  /**
   * Configuration for code generation
   */
  const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I, O, 0, 1 to avoid confusion
  const BATCH_SIZE = 100; // Number of codes to write in a single batch operation
  
  /**
   * Service for managing sticker code generation
   */
  export class CodeGenerationService {
    /**
     * Creates a new batch and initializes generation
     * 
     * @param batchData The batch configuration data
     * @returns The created batch ID and status
     */
    static async createBatch(batchData: Omit<StickerBatch, 'status' | 'createdAt' | 'completedAt' | 'generatedCount'>): Promise<{ batchId: string; status: string }> {
      try {
        // Create a new document reference with auto-generated ID
        const batchesRef = collection(db, 'stickerBatches');
        const newBatchRef = doc(batchesRef);
        
        // Prepare the batch data with initial values
        const batch: StickerBatch = {
          ...batchData,
          status: 'generating',
          createdAt: Timestamp.now(),
          completedAt: null,
          generatedCount: 0
        };
        
        // Write the batch document
        await setDoc(newBatchRef, batch);
        
        // Start generation process
        // For small batches (< 500), do it directly in client
        // For larger batches, call cloud function
        if (batchData.quantity <= 500) {
          this.generateCodes(newBatchRef.id, batch)
            .catch(err => console.error('Error generating codes:', err));
        } else {
          const functions = getFunctions();
          const generateBatchFn = httpsCallable(functions, 'generateCodeBatch');
          generateBatchFn({ batchId: newBatchRef.id })
            .catch(err => console.error('Error calling generateCodeBatch:', err));
        }
        
        return { batchId: newBatchRef.id, status: 'generating' };
      } catch (error) {
        console.error('Error creating batch:', error);
        throw new Error('Failed to create code batch');
      }
    }
    
    /**
     * Generate codes for a batch (client-side implementation for smaller batches)
     * 
     * @param batchId The batch ID
     * @param batchData The batch data
     */
    static async generateCodes(batchId: string, batchData: StickerBatch): Promise<void> {
      try {
        const { prefix, codeLength, quantity } = batchData;
        let generatedCount = 0;
        
        // Process in smaller batches to avoid Firestore write limits
        for (let i = 0; i < quantity; i += BATCH_SIZE) {
          // Calculate the actual batch size (may be smaller for the last batch)
          const currentBatchSize = Math.min(BATCH_SIZE, quantity - i);
          
          // Generate codes for this batch
          const codes = await this.generateUniqueCodesForBatch(
            prefix, 
            codeLength, 
            currentBatchSize
          );
          
          // Write to Firestore in a batch
          const writeBatchOp = writeBatch(db);
          
          for (const code of codes) {
            const codeRef = doc(db, 'stickerCodes', code);
            const codeData: StickerCode = {
              batchId,
              status: 'available',
              createdAt: Timestamp.now(),
              productType: batchData.productType
            };
            
            if (batchData.expirationDate) {
              codeData.expirationDate = batchData.expirationDate;
            }
            
            writeBatchOp.set(codeRef, codeData);
          }
          
          // Commit the batch write
          await writeBatchOp.commit();
          
          // Update the batch document with progress
          generatedCount += codes.length;
          const batchRef = doc(db, 'stickerBatches', batchId);
          await updateDoc(batchRef, {
            generatedCount: increment(codes.length)
          });
        }
        
        // Mark the batch as completed
        const batchRef = doc(db, 'stickerBatches', batchId);
        await updateDoc(batchRef, {
          status: 'completed',
          completedAt: Timestamp.now(),
          generatedCount
        });
        
      } catch (error) {
        console.error('Error generating codes:', error);
        
        // Mark the batch as failed
        const batchRef = doc(db, 'stickerBatches', batchId);
        await updateDoc(batchRef, {
          status: 'failed'
        });
        
        throw error;
      }
    }
    
    /**
     * Generate a set of unique codes for a batch
     * 
     * @param prefix The code prefix
     * @param codeLength The length of the random part
     * @param count The number of codes to generate
     * @returns Array of unique codes
     */
    static async generateUniqueCodesForBatch(
      prefix: string, 
      codeLength: number, 
      count: number
    ): Promise<string[]> {
      const codes: Set<string> = new Set();
      const existingCodes: Set<string> = new Set();
      
      // Fetch existing codes with this prefix to avoid duplicates
      const codesRef = collection(db, 'stickerCodes');
      const prefixQuery = query(
        codesRef, 
        where('__name__', '>=', prefix),
        where('__name__', '<=', prefix + '\uf8ff'),
        limit(10000) // Firestore limit
      );
      
      const snapshot = await getDocs(prefixQuery);
      snapshot.forEach(doc => {
        existingCodes.add(doc.id);
      });
      
      // Generate unique codes
      while (codes.size < count) {
        const randomPart = this.generateRandomString(codeLength);
        const fullCode = `${prefix}${randomPart}`;
        
        // Check if code already exists in Firestore or in our current batch
        if (!existingCodes.has(fullCode) && !codes.has(fullCode)) {
          codes.add(fullCode);
        }
      }
      
      return Array.from(codes);
    }
    
    /**
     * Generate a random string for the code
     * 
     * @param length The length of the random string
     * @returns Random string
     */
    static generateRandomString(length: number): string {
      let result = '';
      const charsLength = ALLOWED_CHARS.length;
      
      for (let i = 0; i < length; i++) {
        result += ALLOWED_CHARS.charAt(Math.floor(Math.random() * charsLength));
      }
      
      return result;
    }
    
    /**
     * Get batch details by ID
     * 
     * @param batchId The batch ID
     * @returns The batch details or null if not found
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
     * Get all batches with optional filtering
     * 
     * @param options Filter options
     * @returns Array of batch documents
     */
    static async getBatches(options: {
      limit?: number;
      status?: string;
    } = {}): Promise<StickerBatchWithId[]> {
      try {
        const batchesRef = collection(db, 'stickerBatches');
        let batchQuery = query(batchesRef);
        
        // Apply filters if provided
        if (options.status) {
          batchQuery = query(batchQuery, where('status', '==', options.status));
        }
        
        // Apply limit if provided
        if (options.limit) {
          batchQuery = query(batchQuery, limit(options.limit));
        }
        
        const snapshot = await getDocs(batchQuery);
        const batches: StickerBatchWithId[] = [];
        
        snapshot.forEach(doc => {
          batches.push({
            id: doc.id,
            ...doc.data()
          } as StickerBatchWithId);
        });
        
        return batches;
      } catch (error) {
        console.error('Error getting batches:', error);
        return [];
      }
    }
    
    /**
     * Update a code's status
     * 
     * @param code The code to update
     * @param status The new status
     * @param assignedTo Optional user ID if being assigned
     * @returns Success flag and message
     */
    static async updateCodeStatus(
      code: string, 
      status: CodeStatus, 
      assignedTo?: string
    ): Promise<{ success: boolean; message: string }> {
      try {
        const codeRef = doc(db, 'stickerCodes', code);
        const codeDoc = await getDoc(codeRef);
        
        if (!codeDoc.exists()) {
          return { success: false, message: 'Code not found' };
        }
        
        const updateData: any = { status };
        
        if (status === 'assigned' && assignedTo) {
          updateData.assignedTo = assignedTo;
          updateData.assignedAt = Timestamp.now();
        }
        
        await updateDoc(codeRef, updateData);
        return { success: true, message: 'Code updated successfully' };
      } catch (error) {
        console.error('Error updating code:', error);
        return { success: false, message: 'Failed to update code' };
      }
    }
  }
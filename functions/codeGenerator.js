// functions/codeGenerator.js

// Update imports to use v2
const { HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Batch size for Firestore writes
const BATCH_SIZE = 500;

// Allowed characters for code generation
const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I, O, 0, 1 to avoid confusion

/**
 * Generate a random string for code generation
 * @param {number} length Length of the random string
 * @returns {string} Random string
 */
function generateRandomString(length) {
  let result = '';
  const charsLength = ALLOWED_CHARS.length;
  
  for (let i = 0; i < length; i++) {
    result += ALLOWED_CHARS.charAt(Math.floor(Math.random() * charsLength));
  }
  
  return result;
}

/**
 * Generate unique codes for a batch
 * @param {string} prefix Code prefix
 * @param {number} codeLength Length of random part
 * @param {number} count Number of codes to generate
 * @returns {Promise<string[]>} Array of unique codes
 */
async function generateUniqueCodesForBatch(prefix, codeLength, count) {
  const db = admin.firestore();
  const codes = new Set();
  const existingCodes = new Set();
  
  // Query existing codes with this prefix to avoid duplicates
  // Use a compound query for efficiency
  const prefixEnd = prefix + '~'; // '~' is higher in ASCII than any allowed character
  
  const snapshot = await db.collection('stickerCodes')
    .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
    .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
    .get();
  
  snapshot.forEach(doc => {
    existingCodes.add(doc.id);
  });
  
  logger.info(`Found ${existingCodes.size} existing codes with prefix ${prefix}`);
  
  // Generate unique codes
  while (codes.size < count) {
    const randomPart = generateRandomString(codeLength);
    const fullCode = `${prefix}${randomPart}`;
    
    // Check if code already exists
    if (!existingCodes.has(fullCode) && !codes.has(fullCode)) {
      codes.add(fullCode);
    }
    
    // Log progress for long running operations
    if (codes.size % 1000 === 0 && codes.size > 0) {
      logger.info(`Generated ${codes.size}/${count} unique codes`);
    }
  }
  
  return Array.from(codes);
}

/**
 * Handler for batch code generation
 */
exports.generateCodeBatchHandler = async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Authentication required to generate codes'
    );
  }
  
  // Validate input
  const { batchId } = data;
  if (!batchId) {
    throw new HttpsError(
      'invalid-argument',
      'Batch ID is required'
    );
  }
  
  const db = admin.firestore();
  
  try {
    // Get batch details
    const batchRef = db.collection('stickerBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    
    if (!batchDoc.exists) {
      throw new HttpsError(
        'not-found',
        'Batch not found'
      );
    }
    
    const batchData = batchDoc.data();
    const { prefix, codeLength, quantity } = batchData;
    
    // Check if already completed or failed
    if (batchData.status === 'completed' || batchData.status === 'failed') {
      throw new HttpsError(
        'failed-precondition',
        `Batch already in ${batchData.status} state`
      );
    }
    
    // Generate codes
    logger.info(`Generating ${quantity} codes with prefix ${prefix} and length ${codeLength}`);
    
    const codes = await generateUniqueCodesForBatch(prefix, codeLength, quantity);
    logger.info(`Generated ${codes.length} unique codes`);
    
    // Write codes to Firestore in batches
    let generatedCount = 0;
    
    for (let i = 0; i < codes.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const codeBatch = codes.slice(i, i + BATCH_SIZE);
      
      for (const code of codeBatch) {
        const codeRef = db.collection('stickerCodes').doc(code);
        batch.set(codeRef, {
          batchId,
          status: 'available',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          productType: batchData.productType || null
        });
      }
      
      await batch.commit();
      generatedCount += codeBatch.length;
      
      // Update batch document with progress
      await batchRef.update({
        generatedCount: admin.firestore.FieldValue.increment(codeBatch.length)
      });
      
      logger.info(`Committed batch of ${codeBatch.length} codes, total: ${generatedCount}/${quantity}`);
    }
    
    // Mark batch as completed
    await batchRef.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedCount
    });
    
    logger.info(`Batch ${batchId} completed successfully`);
    
    return { success: true };
  } catch (error) {
    logger.error('Error generating code batch:', error);
    
    // Mark batch as failed
    try {
      const batchRef = db.collection('stickerBatches').doc(batchId);
      await batchRef.update({
        status: 'failed'
      });
    } catch (updateError) {
      logger.error('Error updating batch status to failed:', updateError);
    }
    
    throw new HttpsError(
      'internal',
      'Error generating codes',
      error.message
    );
  }
};

/**
 * Handler for code export
 */
exports.exportCodesHandler = async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Authentication required to export codes'
    );
  }
  
  // Validate input
  const { batchId, format = 'csv', includeStatus = true } = data;
  const userId = context.auth.uid;
  
  if (!batchId) {
    throw new HttpsError(
      'invalid-argument',
      'Batch ID is required'
    );
  }
  
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  
  try {
    // Get batch details
    const batchRef = db.collection('stickerBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    
    if (!batchDoc.exists) {
      throw new HttpsError(
        'not-found',
        'Batch not found'
      );
    }
    
    const batchData = batchDoc.data();
    
    // Get all codes in the batch
    const codesSnapshot = await db.collection('stickerCodes')
      .where('batchId', '==', batchId)
      .get();
    
    const codes = [];
    codesSnapshot.forEach(doc => {
      if (includeStatus) {
        codes.push({
          code: doc.id,
          status: doc.data().status,
          createdAt: doc.data().createdAt?.toDate()?.toISOString() || null
        });
      } else {
        codes.push({
          code: doc.id
        });
      }
    });
    
    logger.info(`Exporting ${codes.length} codes from batch ${batchId}`);
    
    if (codes.length === 0) {
      throw new HttpsError(
        'not-found',
        'No codes found in this batch'
      );
    }
    
    // Format the output
    let content = '';
    let fileName = '';
    let mimeType = '';
    
    switch (format) {
      case 'csv':
        // Generate CSV content
        if (includeStatus) {
          content = 'Code,Status,CreatedAt\n';
          codes.forEach(item => {
            content += `${item.code},${item.status},${item.createdAt}\n`;
          });
        } else {
          content = 'Code\n';
          codes.forEach(item => {
            content += `${item.code}\n`;
          });
        }
        fileName = `codes_${batchId}_${Date.now()}.csv`;
        mimeType = 'text/csv';
        break;
        
      case 'json':
        content = JSON.stringify({
          batchId,
          batchName: batchData.name,
          exportedAt: new Date().toISOString(),
          codes
        }, null, 2);
        fileName = `codes_${batchId}_${Date.now()}.json`;
        mimeType = 'application/json';
        break;
        
      default:
        throw new HttpsError(
          'invalid-argument',
          'Invalid format specified'
        );
    }
    
    // Create a temporary file
    const tempFilePath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempFilePath, content);
    
    // Upload to Firebase Storage
    const storagePath = `exports/${userId}/${fileName}`;
    
    await bucket.upload(tempFilePath, {
      destination: storagePath,
      metadata: {
        contentType: mimeType,
        metadata: {
          batchId: batchId,
          exportedBy: userId,
          exportTime: new Date().toISOString()
        }
      }
    });
    
    // Delete temporary file
    fs.unlinkSync(tempFilePath);
    
    // Generate a signed URL for download (valid for 1 hour)
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    });
    
    // Track export in Firestore
    const exportRef = db.collection('codeExports').doc();
    await exportRef.set({
      batchId,
      userId,
      fileName,
      format,
      fileSize: content.length,
      storagePath,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      codeCount: codes.length
    });
    
    // Return the download URL
    return {
      downloadUrl: signedUrl,
      fileName,
      codeCount: codes.length
    };
  } catch (error) {
    logger.error('Error exporting codes:', error);
    throw new HttpsError(
      'internal',
      'Error exporting codes: ' + error.message,
      error
    );
  }
};

/**
 * Handler for batch deletion
 */
exports.deleteBatchHandler = async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Authentication required to delete batch'
    );
  }
  
  // Validate input
  const { batchId } = data;
  if (!batchId) {
    throw new HttpsError(
      'invalid-argument',
      'Batch ID is required'
    );
  }
  
  const db = admin.firestore();
  
  try {
    // Check if the batch exists
    const batchRef = db.collection('stickerBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    
    if (!batchDoc.exists) {
      throw new HttpsError(
        'not-found',
        'Batch not found'
      );
    }
    
    // Delete all codes in the batch
    const codesSnapshot = await db.collection('stickerCodes')
      .where('batchId', '==', batchId)
      .get();
    
    if (!codesSnapshot.empty) {
      logger.info(`Deleting ${codesSnapshot.size} codes from batch ${batchId}`);
      
      // Delete in batches to avoid Firestore write limits
      const chunks = [];
      const chunkSize = 500; // Firestore batch limit
      
      for (let i = 0; i < codesSnapshot.size; i += chunkSize) {
        chunks.push(codesSnapshot.docs.slice(i, i + chunkSize));
      }
      
      for (const chunk of chunks) {
        const batch = db.batch();
        
        chunk.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        logger.info(`Deleted batch of ${chunk.length} codes`);
      }
    }
    
    // Finally, delete the batch document
    await batchRef.delete();
    
    logger.info(`Batch ${batchId} deleted successfully`);
    
    return {
      success: true,
      message: 'Batch and all associated codes deleted successfully'
    };
  } catch (error) {
    logger.error('Error deleting batch:', error);
    throw new HttpsError(
      'internal',
      'Error deleting batch',
      error.message
    );
  }
};
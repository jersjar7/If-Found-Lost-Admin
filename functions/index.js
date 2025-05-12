// functions/index.js

// 1) Admin SDK
const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
admin.initializeApp(); // This initializes all Firebase services including Storage

// 2) Import Firebase Functions v2 instead of v1
//    - onCall replaces https.onCall
//    - HttpsError for throwing proper auth/argument errors
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

// 3) Handle login attempt function - updated to v2
exports.handleLoginAttempt = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
  },
  async (req) => {
    const { data, auth } = req;
    const { email, success } = data;

    if (success) {
      // Reset on successful login
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(user.uid, { disabled: false });
      const ref = admin.firestore().collection('adminUsers').doc(user.uid);
      await ref.update({
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAttempt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { success: true };
    }

    // Failed login attempt
    if (!auth || !auth.uid) {
      // If you want to gate this to signed-in callers only
      throw new HttpsError('unauthenticated', 'Must be signed in to attempt login.');
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      const ref = admin.firestore().collection('adminUsers').doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return { success: false, message: 'Invalid email/password combination' };
      }

      const userData = snap.data();
      const now = new Date();

      // Already locked?
      if (userData.accountLockedUntil?.toDate() > now) {
        const mins = Math.ceil((userData.accountLockedUntil.toDate() - now) / 60000);
        return {
          success: false,
          locked: true,
          message: `Account locked. Try again in ${mins} minutes.`,
        };
      }

      // Increment attempt count
      const attempts = (userData.failedLoginAttempts || 0) + 1;
      const payload = {
        failedLoginAttempts: attempts,
        lastLoginAttempt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Lock if over threshold
      if (attempts >= 5) {
        const lockExpiry = new Date();
        lockExpiry.setMinutes(lockExpiry.getMinutes() + 30);
        payload.accountLockedUntil = lockExpiry;

        // 1) update Firestore
        await ref.update(payload);
        // 2) disable Auth user
        await admin.auth().updateUser(user.uid, { disabled: true });

        return {
          success: false,
          locked: true,
          message: `Account locked due to too many failed attempts. Try again in 30 minutes.`,
        };
      }

      // Otherwise just record the attempt
      await ref.update(payload);
      const left = 5 - attempts;
      return {
        success: false,
        locked: false,
        message: `Invalid email/password combination. ${left} attempts remaining.`,
      };
    } catch (err) {
      logger.error('handleLoginAttempt error', err);
      return { success: false, message: 'Invalid email/password combination' };
    }
  }
);

// 4) Scheduled unlocker every 5 minutes - updated to v2 scheduler
exports.autoUnlockUsers = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'us-central1',
    timeoutSeconds: 120,
  },
  async (context) => {
    const now = admin.firestore.Timestamp.now();
    const usersRef = admin.firestore().collection('adminUsers');
    const expired = await usersRef.where('accountLockedUntil', '<=', now).get();

    for (const docSnap of expired.docs) {
      const uid = docSnap.id;
      try {
        // 1) Re-enable in Auth
        await admin.auth().updateUser(uid, { disabled: false });
        // 2) Clear lock fields in Firestore
        await docSnap.ref.update({
          failedLoginAttempts: 0,
          accountLockedUntil: null,
        });
        logger.info(`Auto-unlocked user ${uid}`);
      } catch (err) {
        logger.error(`Failed to auto-unlock ${uid}:`, err);
      }
    }

    return null;
  }
);

// 5) Import the code generator functions
const codeGenerator = require('./codeGenerator');

// Generate batch function - updated to v2
exports.generateCodeBatch = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
    timeoutSeconds: 300, // 5 minutes for longer operations
  },
  async (req) => {
    const { data, auth } = req;
    // forward to your existing handler
    return await codeGenerator.generateCodeBatchHandler(data, { auth });
  }
);

// Export codes function - updated to v2
exports.exportCodes = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 10, timeoutSeconds: 300 },
  async (req) => {
    logger.info('👀 exportCodes – req.auth =', req.auth);
    return await codeGenerator.exportCodesHandler(req.data, { auth: req.auth });
  }
);

// Delete batch function - updated to v2
exports.deleteBatch = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 10, timeoutSeconds: 300 },
  async (req) => {
    logger.info('👀 deleteBatch – req.auth =', req.auth);
    return await codeGenerator.deleteBatchHandler(req.data, { auth: req.auth });
  }
);

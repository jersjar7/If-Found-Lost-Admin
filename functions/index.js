// functions/index.js

// 1) Admin SDK
const admin = require('firebase-admin');
admin.initializeApp(); // This initializes all Firebase services including Storage

// 2) Import Firebase Functions v1 explicitly - this is the key change
const functions = require('firebase-functions/v1');
const logger = require('firebase-functions/logger');

// 3) Handle login attempt function
exports.handleLoginAttempt = functions.https.onCall(async (data, context) => {
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
      lastLoginAttempt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  }

  // Failed login attempt
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
        message: `Account locked. Try again in ${mins} minutes.`
      };
    }

    // Increment attempt count
    const attempts = (userData.failedLoginAttempts || 0) + 1;
    const payload = {
      failedLoginAttempts: attempts,
      lastLoginAttempt: admin.firestore.FieldValue.serverTimestamp()
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
        message: `Account locked due to too many failed attempts. Try again in 30 minutes.`
      };
    }

    // Otherwise just record the attempt
    await ref.update(payload);
    const left = 5 - attempts;
    return {
      success: false,
      locked: false,
      message: `Invalid email/password combination. ${left} attempts remaining.`
    };

  } catch (err) {
    logger.error('handleLoginAttempt error', err);
    return { success: false, message: 'Invalid email/password combination' };
  }
});

// 4) Scheduled unlocker every 5 minutes - using v1 pubsub.schedule
exports.autoUnlockUsers = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
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
        accountLockedUntil: null
      });
      logger.info(`Auto-unlocked user ${uid}`);
    } catch (err) {
      logger.error(`Failed to auto-unlock ${uid}:`, err);
    }
  }

  return null;
});

// 5) Import the code generator functions
const codeGenerator = require('./codeGenerator');

// Generate batch function
exports.generateCodeBatch = functions.https.onCall(async (data, context) => {
  return await codeGenerator.generateCodeBatchHandler(data, context);
});

// Export codes function
exports.exportCodes = functions.https.onCall(async (data, context) => {
  return await codeGenerator.exportCodesHandler(data, context);
});

// Delete batch function
exports.deleteBatch = functions.https.onCall(async (data, context) => {
  return await codeGenerator.deleteBatchHandler(data, context);
});
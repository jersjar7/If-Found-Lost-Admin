// functions/index.js

// 1) Admin SDK
const admin = require('firebase-admin');
admin.initializeApp();

// 2) HTTPS v2 Callable with CORS enabled for *all* origins
const { onCall } = require('firebase-functions/v2/https');
const logger   = require('firebase-functions/logger');

exports.handleLoginAttempt = onCall(
  { cors: true },      // <-- allow any origin
  async (req) => {
    const { email, success } = req.data;

    if (success) {
      // Reset on successful login
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(user.uid, { disabled: false });
      const ref = admin.firestore().collection('adminUsers').doc(user.uid);
      await ref.update({
        failedLoginAttempts: 0,
        accountLockedUntil:  null,
        lastLogin:           admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAttempt:    admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    }

    // Failed login attempt
    try {
      const user = await admin.auth().getUserByEmail(email);
      const ref  = admin.firestore().collection('adminUsers').doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return { success: false, message: 'Invalid email/password combination' };
      }

      const data = snap.data();
      const now  = new Date();

      // Already locked?
      if (data.accountLockedUntil?.toDate() > now) {
        const mins = Math.ceil((data.accountLockedUntil.toDate() - now) / 60000);
        return {
          success: false,
          locked:  true,
          message: `Account locked. Try again in ${mins} minutes.`
        };
      }

      // Increment attempt count
      const attempts = (data.failedLoginAttempts || 0) + 1;
      const payload  = {
        failedLoginAttempts: attempts,
        lastLoginAttempt:    admin.firestore.FieldValue.serverTimestamp()
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
          locked:  true,
          message: `Account locked due to too many failed attempts. Try again in 30 minutes.`
        };
      }

      // Otherwise just record the attempt
      await ref.update(payload);
      const left = 5 - attempts;
      return {
        success: false,
        locked:  false,
        message: `Invalid email/password combination. ${left} attempts remaining.`
      };

    } catch (err) {
      logger.error('handleLoginAttempt error', err);
      return { success: false, message: 'Invalid email/password combination' };
    }
  }
);

// New: Scheduled unlocker every 5 minutes
const { schedule } = require('firebase-functions/v2/pubsub');
exports.autoUnlockUsers = schedule('every 5 minutes').onRun(async (event) => {
  const now = admin.firestore.Timestamp.now();
  const usersRef = admin.firestore().collection('adminUsers');
  const expired = await usersRef
    .where('accountLockedUntil', '<=', now)
    .get();

  for (const docSnap of expired.docs) {
    const uid = docSnap.id;
    try {
      // 1) Re-enable in Auth
      await admin.auth().updateUser(uid, { disabled: false });
      // 2) Clear lock fields in Firestore
      await docSnap.ref.update({
        failedLoginAttempts: 0,
        accountLockedUntil:  null
      });
      logger.info(`Unlocked user ${uid} after expiry`);
    } catch (err) {
      logger.error(`Failed to auto-unlock ${uid}:`, err);
    }
  }

  return null;
});

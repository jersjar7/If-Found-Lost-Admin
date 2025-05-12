// src/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

// IMPORTANT: Initialize functions with the correct region
export const functions = getFunctions(app, 'us-central1');

// IMPORTANT: Set the custom domain for your functions
// This is critical for v2 functions to work correctly
// Uncomment and set the following if using a custom domain:
// functions.customDomain = "your-custom-domain.com";

// For local development/testing only - comment out in production
// import { connectFunctionsEmulator } from 'firebase/functions';
// connectFunctionsEmulator(functions, "localhost", 5001);
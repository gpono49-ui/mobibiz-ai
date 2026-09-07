import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

let firebaseApp: ReturnType<typeof initializeApp> | null = null;

function initFirebase() {
  if (firebaseApp) return firebaseApp;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    // We do not throw here to allow build-time operations without env; pages should handle missing config.
    console.warn('Missing NEXT_PUBLIC_FIREBASE_* environment variables for admin-dashboard');
  }

  firebaseApp = initializeApp(config as any);
  return firebaseApp;
}

export const firebase = initFirebase();
export const auth = getAuth(typeof window !== 'undefined' ? firebase as any : undefined as any);
export const db = getFirestore(typeof window !== 'undefined' ? firebase as any : undefined as any);
export const functions = getFunctions(typeof window !== 'undefined' ? firebase as any : undefined as any);

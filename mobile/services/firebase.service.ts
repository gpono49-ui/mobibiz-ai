import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDb: Firestore;

/**
 * Initialize Firebase with client configuration.
 * Environment variables must be prefixed with EXPO_PUBLIC_ to be accessible.
 */
export function initializeFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  // Validate required configuration
  const requiredConfig = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
  ];

  const missingConfig = requiredConfig.filter(key => !process.env[key]);
  if (missingConfig.length > 0) {
    throw new Error(
      `Missing required Firebase configuration: ${missingConfig.join(', ')}\n` +
      `Please configure environment variables in .env.local`
    );
  }

  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Initialize Firebase only once
  if (!firebaseApp) {
    firebaseApp = initializeApp(config);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
  }

  return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb };
}

/**
 * Get the singleton Firebase app instance.
 * Must call initializeFirebase() first.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return firebaseApp;
}

/**
 * Get the singleton Auth instance.
 * Must call initializeFirebase() first.
 */
export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth not initialized. Call initializeFirebase() first.');
  }
  return firebaseAuth;
}

/**
 * Get the singleton Firestore instance.
 * Must call initializeFirebase() first.
 */
export function getFirebaseDb(): Firestore {
  if (!firebaseDb) {
    throw new Error('Firestore not initialized. Call initializeFirebase() first.');
  }
  return firebaseDb;
}

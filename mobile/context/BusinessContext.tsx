import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  limit,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../services/firebase.service';
import { Business, validateBusiness, firestoreTimestampToDate } from '../types';
import { useAuth } from './AuthContext';

interface BusinessContextType {
  business: Business | null;
  loading: boolean;
  error: string | null;
  createBusiness: (data: Omit<Business, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBusiness: (data: Partial<Omit<Business, 'userId'>>) => Promise<void>;
  fetchBusiness: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const { state: authState } = useAuth();

  const fetchBusiness = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = authState.user;
      if (!currentUser) {
        setBusiness(null);
        setLoading(false);
        return;
      }

      // Fetch user's business (currently supports one business per user)
      const businessesRef = collection(db, `users/${currentUser.uid}/businesses`);
      const businessQuery = query(businessesRef, limit(1));
      const businessSnap = await getDocs(businessQuery);

      if (!businessSnap.empty) {
        const doc = businessSnap.docs[0];
        const validatedBusiness = validateBusiness(doc.data(), doc.id);
        setBusiness(validatedBusiness);
      } else {
        setBusiness(null);
      }
    } catch (err: any) {
      const message = err.message || 'Failed to fetch business';
      setError(message);
      console.error('Error fetching business:', err);
    } finally {
      setLoading(false);
    }
  }, [authState.user, db]);

  const createBusiness = useCallback(
    async (data: Omit<Business, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      try {
        setError(null);
        const currentUser = authState.user;
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        // Create new business document
        // Security: userId is always set to current user, never from client data
        const businessDocRef = doc(collection(db, `users/${currentUser.uid}/businesses`));

        const businessData = {
          ...data,
          userId: currentUser.uid, // Immutable - always current user
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(businessDocRef, businessData);

        // Create local representation
        const newBusiness: Business = {
          id: businessDocRef.id,
          ...data,
          userId: currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setBusiness(newBusiness);

        // Update user profile to mark setup as completed
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(
          userDocRef,
          {
            hasCompletedSetup: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err: any) {
        const message = err.message || 'Failed to create business';
        setError(message);
        throw new Error(message);
      }
    },
    [authState.user, db]
  );

  const updateBusiness = useCallback(
    async (data: Partial<Omit<Business, 'userId'>>) => {
      try {
        setError(null);
        const currentUser = authState.user;
        if (!currentUser || !business?.id) {
          throw new Error('Missing required data');
        }

        // Security: Never allow userId to be changed
        const safeData = { ...data };
        delete (safeData as any).userId;

        const businessDocRef = doc(db, `users/${currentUser.uid}/businesses`, business.id);
        await setDoc(
          businessDocRef,
          {
            ...safeData,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Update local state
        const updatedBusiness: Business = {
          ...business,
          ...safeData,
          updatedAt: new Date(),
        };
        setBusiness(updatedBusiness);
      } catch (err: any) {
        const message = err.message || 'Failed to update business';
        setError(message);
        throw new Error(message);
      }
    },
    [authState.user, business, db]
  );

  // Fetch business when user changes
  useEffect(() => {
    if (authState.user) {
      fetchBusiness();
    } else {
      setBusiness(null);
      setLoading(false);
    }
  }, [authState.user, fetchBusiness]);

  return (
    <BusinessContext.Provider value={{ business, loading, error, createBusiness, updateBusiness, fetchBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = (): BusinessContextType => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within BusinessProvider');
  }
  return context;
};

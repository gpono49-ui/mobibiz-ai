import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../services/firebase.service';
import { Subscription, Entitlement, validateSubscription, firestoreTimestampToDate } from '../types';
import { useAuth } from './AuthContext';

interface EntitlementContextType {
  entitlement: Entitlement | null;
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  checkEntitlement: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextType | undefined>(undefined);

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const db = getFirebaseDb();
  const { state: authState } = useAuth();

  const checkEntitlement = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = authState.user;
      if (!currentUser) {
        setEntitlement(null);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      const subscriptionDocRef = doc(db, 'subscriptions', currentUser.uid);
      const subscriptionDocSnap = await getDoc(subscriptionDocRef);

      if (subscriptionDocSnap.exists()) {
        try {
          const subData = validateSubscription(subscriptionDocSnap.data());
          const expiryDate = firestoreTimestampToDate(subscriptionDocSnap.data().expiryDate);
          const isCurrentlyActive = subData.status === 'active' && expiryDate > new Date();

          setEntitlement({
            userId: subData.userId,
            isPremium: isCurrentlyActive,
            planId: subData.planId,
            expiryDate: expiryDate,
            status: subData.status,
          });

          setIsPremium(isCurrentlyActive);
        } catch (validationError: any) {
          console.error('Error validating subscription:', validationError);
          setEntitlement(null);
          setIsPremium(false);
        }
      } else {
        setEntitlement(null);
        setIsPremium(false);
      }
    } catch (err: any) {
      console.error('Error checking entitlement:', err);
      setError('Failed to check subscription status');
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, [authState.user, db]);

  // Check entitlement when user changes
  useEffect(() => {
    if (authState.user) {
      checkEntitlement();
    } else {
      setLoading(false);
      setIsPremium(false);
      setEntitlement(null);
    }
  }, [authState.user, checkEntitlement]);

  // Re-check entitlement periodically (every 5 minutes)
  // This ensures we catch subscription expirations and renewal
  useEffect(() => {
    if (!authState.user) return;

    const interval = setInterval(() => {
      checkEntitlement();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [authState.user, checkEntitlement]);

  return (
    <EntitlementContext.Provider value={{ entitlement, loading, error, isPremium, checkEntitlement }}>
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlement = (): EntitlementContextType => {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlement must be used within EntitlementProvider');
  }
  return context;
};

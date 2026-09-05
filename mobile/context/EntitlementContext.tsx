import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

interface Subscription {
  userId: string;
  planId: string;
  status: 'active' | 'expired' | 'cancelled';
  expiryDate: Date;
  autoRenew: boolean;
  purchaseDate: Date;
}

interface EntitlementContextType {
  isPremium: boolean;
  subscription: Subscription | null;
  loading: boolean;
  checkEntitlement: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextType | undefined>(undefined);

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getFirestore();

  const checkEntitlement = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        setIsPremium(false);
        setSubscription(null);
        return;
      }

      const subscriptionDocRef = doc(db, 'subscriptions', currentUser.uid);
      const subscriptionDocSnap = await getDoc(subscriptionDocRef);
      
      if (subscriptionDocSnap.exists()) {
        const subData = subscriptionDocSnap.data() as Subscription;
        setSubscription(subData);
        
        // Check if subscription is currently active
        const isActive = subData.status === 'active' && new Date(subData.expiryDate) > new Date();
        setIsPremium(isActive);
      } else {
        setIsPremium(false);
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error checking entitlement:', error);
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      checkEntitlement();
    } else {
      setLoading(false);
      setIsPremium(false);
      setSubscription(null);
    }
  }, [auth.currentUser]);

  // Re-check entitlement periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (auth.currentUser) {
        checkEntitlement();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <EntitlementContext.Provider value={{ isPremium, subscription, loading, checkEntitlement }}>
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlement = () => {
  const context = useContext(EntitlementContext);
  if (context === undefined) {
    throw new Error('useEntitlement must be used within EntitlementProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

interface Business {
  id?: string;
  userId: string;
  name: string;
  type: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  hasCompletedSetup: boolean;
  isPremium: boolean;
}

interface BusinessContextType {
  business: Business | null;
  userProfile: UserProfile | null;
  loading: boolean;
  createBusiness: (data: Omit<Business, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBusiness: (data: Partial<Business>) => Promise<void>;
  fetchBusiness: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getFirestore();

  const fetchBusiness = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Fetch user profile
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        setUserProfile(userDocSnap.data() as UserProfile);
      }

      // Fetch user's business
      const businessesRef = collection(db, `users/${currentUser.uid}/businesses`);
      const businessQuery = query(businessesRef);
      const businessSnap = await getDocs(businessQuery);
      
      if (!businessSnap.empty) {
        const businessData = businessSnap.docs[0].data() as Business;
        businessData.id = businessSnap.docs[0].id;
        setBusiness(businessData);
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBusiness = async (data: Omit<Business, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user');

      const businessDocRef = doc(collection(db, `users/${currentUser.uid}/businesses`));
      const now = new Date();
      
      const newBusiness: Business = {
        ...data,
        userId: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(businessDocRef, newBusiness);
      newBusiness.id = businessDocRef.id;
      setBusiness(newBusiness);

      // Update user profile
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        createdAt: now,
        updatedAt: now,
        hasCompletedSetup: true,
        isPremium: false,
      }, { merge: true });
    } catch (error) {
      console.error('Error creating business:', error);
      throw error;
    }
  };

  const updateBusiness = async (data: Partial<Business>) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !business?.id) throw new Error('Missing required data');

      const businessDocRef = doc(db, `users/${currentUser.uid}/businesses`, business.id);
      await setDoc(businessDocRef, { ...data, updatedAt: new Date() }, { merge: true });
      
      setBusiness(prev => prev ? { ...prev, ...data, updatedAt: new Date() } : null);
    } catch (error) {
      console.error('Error updating business:', error);
      throw error;
    }
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      fetchBusiness();
    }
  }, [auth.currentUser]);

  return (
    <BusinessContext.Provider value={{ business, userProfile, loading, createBusiness, updateBusiness, fetchBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within BusinessProvider');
  }
  return context;
};

import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

/**
 * User profile stored in Firestore.
 * Role is server-controlled and cannot be changed by the client.
 * Premium status comes from the Subscription collection, not here.
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'user'; // Only 'user' for normal accounts. Admin/owner set server-side.
  createdAt: Date;
  updatedAt: Date;
  hasCompletedSetup: boolean;
}

/**
 * Business entity owned by a user.
 */
export interface Business {
  id: string;
  userId: string; // Immutable - user's UID
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

/**
 * Subscription status from Google Play or other verified source.
 * This collection can only be written by the backend, never by clients.
 */
export interface Subscription {
  userId: string; // Immutable - user's UID
  planId: 'weekly' | 'monthly' | 'premium_monthly' | 'yearly';
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  expiryDate: Date; // Firestore Timestamp, converted to Date
  autoRenew: boolean;
  purchaseDate: Date;
  transactionId?: string; // From Google Play
  updatedAt: Date;
}

/**
 * Cached entitlement info read from Subscription.
 * Never trust the client's local cache for Premium features - always verify server state.
 */
export interface Entitlement {
  userId: string;
  isPremium: boolean;
  planId?: string;
  expiryDate?: Date;
  status?: string;
}

/**
 * Product (good or service) sold by business.
 */
export interface Product {
  id: string;
  userId: string;
  businessId: string;
  name: string;
  sku?: string;
  category?: string;
  costPrice: number; // UGX or configured currency
  sellingPrice: number;
  quantity: number;
  lowStockThreshold: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sales transaction.
 */
export interface Sale {
  id: string;
  userId: string;
  businessId: string;
  customerId?: string; // Optional
  date: Date;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Expense transaction.
 */
export interface Expense {
  id: string;
  userId: string;
  businessId: string;
  category: string;
  amount: number;
  description?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Customer record.
 */
export interface Customer {
  id: string;
  userId: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Customer debt/payment record.
 */
export interface CustomerDebt {
  id: string;
  userId: string;
  businessId: string;
  customerId: string;
  amount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert Firestore Timestamp to JavaScript Date.
 * Firestore returns Timestamp objects that need to be converted for use in the UI.
 */
export function firestoreTimestampToDate(timestamp: any): Date {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  return new Date();
}

/**
 * Validate that data conforms to expected types.
 * Guard against malformed Firestore documents.
 */
export function validateUserProfile(data: any): UserProfile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid user profile data');
  }

  return {
    uid: data.uid || '',
    email: data.email || '',
    displayName: data.displayName,
    photoURL: data.photoURL,
    role: 'user', // Always enforce 'user' role
    createdAt: firestoreTimestampToDate(data.createdAt),
    updatedAt: firestoreTimestampToDate(data.updatedAt),
    hasCompletedSetup: Boolean(data.hasCompletedSetup),
  };
}

export function validateBusiness(data: any, docId: string): Business {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid business data');
  }

  return {
    id: docId,
    userId: data.userId || '',
    name: data.name || '',
    type: data.type || '',
    ownerName: data.ownerName || '',
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    currency: data.currency || 'UGX',
    logo: data.logo,
    createdAt: firestoreTimestampToDate(data.createdAt),
    updatedAt: firestoreTimestampToDate(data.updatedAt),
  };
}

export function validateSubscription(data: any): Subscription {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid subscription data');
  }

  return {
    userId: data.userId || '',
    planId: data.planId || 'monthly',
    status: data.status || 'pending',
    expiryDate: firestoreTimestampToDate(data.expiryDate),
    autoRenew: Boolean(data.autoRenew),
    purchaseDate: firestoreTimestampToDate(data.purchaseDate),
    transactionId: data.transactionId,
    updatedAt: firestoreTimestampToDate(data.updatedAt),
  };
}

import React, { useReducer, useCallback, useEffect } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  User,
  Auth,
} from 'firebase/auth';
import { getErrorMessage } from '../utils/errorMapping';
import { getFirebaseAuth } from '../services/firebase.service';

export interface AuthState {
  isLoading: boolean;
  isSignout: boolean;
  user: User | null;
  error: string | null;
}

export type AuthAction =
  | { type: 'RESTORE_TOKEN'; payload: User | null }
  | { type: 'SIGN_IN'; payload: User }
  | { type: 'SIGN_UP'; payload: User }
  | { type: 'SIGN_OUT' }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return {
        isLoading: false,
        isSignout: false,
        user: action.payload,
        error: null,
      };
    case 'SIGN_IN':
    case 'SIGN_UP':
      return {
        isLoading: false,
        isSignout: false,
        user: action.payload,
        error: null,
      };
    case 'SIGN_OUT':
      return {
        isLoading: false,
        isSignout: true,
        user: null,
        error: null,
      };
    case 'ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

export interface AuthContextType {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isLoading: true,
    isSignout: false,
    user: null,
    error: null,
  });

  const auth = getFirebaseAuth();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      try {
        dispatch({ type: 'RESTORE_TOKEN', payload: user });
      } catch (error) {
        console.error('Auth state listener error:', error);
        dispatch({ type: 'ERROR', payload: getErrorMessage(error) });
      }
    });

    return unsubscribe;
  }, [auth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        dispatch({ type: 'CLEAR_ERROR' });
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        dispatch({ type: 'SIGN_IN', payload: userCredential.user });
      } catch (error: any) {
        const message = getErrorMessage(error);
        dispatch({ type: 'ERROR', payload: message });
        throw new Error(message);
      }
    },
    [auth]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        dispatch({ type: 'CLEAR_ERROR' });
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Email verification will be handled in a separate flow
        // Note: User profile creation happens via Cloud Function
        dispatch({ type: 'SIGN_UP', payload: userCredential.user });
      } catch (error: any) {
        const message = getErrorMessage(error);
        dispatch({ type: 'ERROR', payload: message });
        throw new Error(message);
      }
    },
    [auth]
  );

  const signOut = useCallback(async () => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await firebaseSignOut(auth);
      dispatch({ type: 'SIGN_OUT' });
    } catch (error: any) {
      const message = getErrorMessage(error);
      dispatch({ type: 'ERROR', payload: message });
      throw new Error(message);
    }
  }, [auth]);

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        dispatch({ type: 'CLEAR_ERROR' });
        await sendPasswordResetEmail(auth, email);
      } catch (error: any) {
        const message = getErrorMessage(error);
        dispatch({ type: 'ERROR', payload: message });
        throw new Error(message);
      }
    },
    [auth]
  );

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: AuthContextType = {
    state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

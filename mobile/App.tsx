// Mobile app entry point with Firebase initialization
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { AuthStack } from './navigation/AuthStack';
import { AppStack } from './navigation/AppStack';
import { LoadingScreen } from './screens/LoadingScreen';
import { AuthContext } from './context/AuthContext';
import { firebaseConfig } from './config/firebase';

SplashScreen.keepAsync();

const Stack = createNativeStackNavigator();

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firebaseDb = getFirestore(firebaseApp);

export default function App() {
  const [state, dispatch] = React.useReducer(
    (prevState: any, action: any) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            isLoading: false,
            isSignout: false,
            userToken: action.payload,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.payload,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
    }
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user: User | null) => {
      try {
        if (user) {
          dispatch({ type: 'SIGN_IN', payload: user.uid });
        } else {
          dispatch({ type: 'SIGN_OUT' });
        }
      } catch (e) {
        console.error('Auth state change error:', e);
        dispatch({ type: 'SIGN_OUT' });
      } finally {
        await SplashScreen.hideAsync();
      }
    });

    return unsubscribe;
  }, []);

  const authContext = React.useMemo(
    () => ({
      signIn: async (email: string, password: string) => {
        try {
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          await signInWithEmailAndPassword(firebaseAuth, email, password);
          dispatch({ type: 'SIGN_IN', payload: firebaseAuth.currentUser?.uid });
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
      signUp: async (email: string, password: string) => {
        try {
          const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
          const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          await sendEmailVerification(userCredential.user);
          dispatch({ type: 'SIGN_IN', payload: userCredential.user.uid });
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
      signOut: async () => {
        try {
          const { signOut } = await import('firebase/auth');
          await signOut(firebaseAuth);
          dispatch({ type: 'SIGN_OUT' });
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
      resetPassword: async (email: string) => {
        try {
          const { sendPasswordResetEmail } = await import('firebase/auth');
          await sendPasswordResetEmail(firebaseAuth, email);
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
    }),
    []
  );

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animationEnabled: true,
          }}
        >
          {state.userToken == null ? (
            <Stack.Group screenOptions={{ animationEnabled: false }}>
              <Stack.Screen name="Auth" component={AuthStack} />
            </Stack.Group>
          ) : (
            <Stack.Group screenOptions={{ animationEnabled: false }}>
              <Stack.Screen name="App" component={AppStack} />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
    </AuthContext.Provider>
  );
}

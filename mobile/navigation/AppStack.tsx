import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { BusinessSetupScreen } from '../screens/BusinessSetupScreen';
import { useBusiness } from '../context/BusinessContext';
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#1F97D4',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
    </Tab.Navigator>
  );
}

export function AppStack() {
  const { business, loading } = useBusiness();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1F97D4" />
      </View>
    );
  }

  // Route to Business Setup if user hasn't completed setup
  if (!business) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BusinessSetup" component={BusinessSetupScreen} />
      </Stack.Navigator>
    );
  }

  // Route to main app after business setup is complete
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}

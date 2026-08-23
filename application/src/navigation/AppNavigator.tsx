import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { getHasOnboarded } from '../utils/onboarding';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import MainTabs from './MainTabs';
import DeliveryNavigator from './DeliveryNavigator';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProductListScreen from '../screens/ProductListScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import WishlistScreen from '../screens/WishlistScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import AddPetScreen from '../screens/AddPetScreen';
import SupportTicketsScreen from '../screens/SupportTicketsScreen';
import NewSupportTicketScreen from '../screens/NewSupportTicketScreen';
import SupportTicketDetailScreen from '../screens/SupportTicketDetailScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';
import HealthTipArticleScreen from '../screens/HealthTipArticleScreen';

import { RootStackParamList } from '../types/navigation.types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => { getHasOnboarded().then(setOnboarded); }, []);

  if (isLoading || onboarded === null) return <SplashScreen />;

  // Role-based routing: a logged-in delivery partner gets the dedicated delivery
  // app and never the customer shop. Everyone else (customers / guests) gets the
  // normal store. Because this reads reactive auth state, logging in as a partner
  // swaps the whole tree automatically, and logging out swaps it back.
  if (user?.role === 'delivery') return <DeliveryNavigator />;

  // The 5 main destinations live in a persistent bottom-tab navigator (Main).
  // Drill-down and modal screens sit in the outer stack on top of it.
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={onboarded ? 'Main' : 'Onboarding'}>
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <RootStack.Screen name="ProductList" component={ProductListScreen} />
          <RootStack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <RootStack.Screen name="Checkout" component={CheckoutScreen} />
          <RootStack.Screen name="Notifications" component={NotificationsScreen} />
          <RootStack.Screen name="Wishlist" component={WishlistScreen} />
          <RootStack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <RootStack.Screen name="LiveTracking" component={LiveTrackingScreen} />
          <RootStack.Screen name="HealthTipArticle" component={HealthTipArticleScreen} />
          <RootStack.Screen name="MyPets" component={MyPetsScreen} />
          <RootStack.Screen name="AddPet" component={AddPetScreen} />
          <RootStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
          <RootStack.Screen name="NewSupportTicket" component={NewSupportTicketScreen} />
          <RootStack.Screen name="SupportTicketDetail" component={SupportTicketDetailScreen} />
        </RootStack.Group>
        <RootStack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="Signup" component={SignupScreen} />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;

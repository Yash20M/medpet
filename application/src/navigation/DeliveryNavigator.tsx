import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DeliveryHomeScreen from '../screens/delivery/DeliveryHomeScreen';
import DeliveryOrderDetailScreen from '../screens/delivery/DeliveryOrderDetailScreen';
import { DeliveryStackParamList } from '../types/navigation.types';

const Stack = createNativeStackNavigator<DeliveryStackParamList>();

/**
 * The entire app a delivery partner sees. Rendered by RootNavigator whenever the
 * logged-in user's role is 'delivery' — it fully replaces the customer app, so a
 * partner never sees the shop, cart, etc.
 */
const DeliveryNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreen} />
      <Stack.Screen
        name="DeliveryOrderDetail"
        component={DeliveryOrderDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  </NavigationContainer>
);

export default DeliveryNavigator;

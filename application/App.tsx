import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { WishlistProvider } from './src/context/WishlistContext';
import { PetsProvider } from './src/context/PetsContext';
import RootNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PetsProvider>
            <CartProvider>
              <WishlistProvider>
                <NotificationsProvider>
                  <StatusBar style="dark" />
                  <RootNavigator />
                </NotificationsProvider>
              </WishlistProvider>
            </CartProvider>
          </PetsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

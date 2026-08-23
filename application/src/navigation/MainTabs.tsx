import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import BottomNav, { TabKey } from '../components/BottomNav';
import { MainTabParamList } from '../types/navigation.types';

import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Routes that require an account; guests are bounced to the Login modal instead.
const PROTECTED: TabKey[] = ['Orders', 'Profile'];

const AppTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const active = state.routes[state.index].name as TabKey;

  const onTab = (key: TabKey) => {
    if (key === active) return;
    if (PROTECTED.includes(key) && !isAuthenticated) {
      navigation.navigate('Login' as never); // bubbles up to the root stack
      return;
    }
    navigation.navigate(key);
  };

  return <BottomNav active={active} onTab={onTab} cartCount={itemCount} />;
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{ headerShown: false }}
    tabBar={(props) => <AppTabBar {...props} />}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Categories" component={CategoriesScreen} />
    <Tab.Screen name="Cart" component={CartScreen} />
    <Tab.Screen name="Orders" component={OrdersScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export default MainTabs;

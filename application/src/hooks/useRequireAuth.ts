import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation.types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Guest-first gate: runs `action` if the user is signed in, otherwise opens the
 * auth modal (Signup for ordering flows, Login for profile). Mirrors the
 * semantics already used across the app.
 */
export const useRequireAuth = () => {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<Nav>();

  return (action?: () => void, screen: 'Login' | 'Signup' = 'Signup') => {
    if (!isAuthenticated) {
      navigation.navigate(screen);
      return;
    }
    action?.();
  };
};

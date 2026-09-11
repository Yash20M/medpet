import React, {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI, ApiError } from '../services/api';
import { User } from '../types/auth.types';
import { registerForPushNotificationsAsync } from '../services/notificationService';

const USER_CACHE_KEY = 'authUser';

const cacheUser = (user: User | null): Promise<void> =>
  user
    ? SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(user))
    : SecureStore.deleteItemAsync(USER_CACHE_KEY);

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// TEMPORARY, for manual FCM verification only (Firebase Console → send-to-token
// test) — no backend endpoint exists yet to receive this. Replace with a real
// API call once one does; never persist/send it anywhere else until then.
const logPushToken = (token: string | null): void => {
  if (token) console.log('[push] FCM device token:', token);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Hydrate from the last-known profile immediately so a slow/unreachable
      // backend doesn't bounce an already-logged-in user back to the login screen.
      const cached = await SecureStore.getItemAsync(USER_CACHE_KEY);
      if (cached) {
        try { setUser(JSON.parse(cached) as User); } catch { /* ignore corrupt cache */ }
      }
      setIsLoading(false);

      // Revalidate in the background. Only sign the user out for an actual
      // auth failure (401/403) — network errors or a flaky server must not
      // destroy a perfectly valid session.
      try {
        const res = await authAPI.getProfile();
        setUser(res.data);
        await cacheUser(res.data);
      } catch (err) {
        const status = (err as ApiError).status;
        if (status === 401 || status === 403) {
          await SecureStore.deleteItemAsync('authToken');
          await cacheUser(null);
          setUser(null);
        }
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authAPI.login({ email, password });
    await SecureStore.setItemAsync('authToken', res.data.token);
    await cacheUser(res.data.user);
    setUser(res.data.user);
    registerForPushNotificationsAsync().then(logPushToken).catch(() => undefined);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const res = await authAPI.register({ name, email, password, phone });
    await SecureStore.setItemAsync('authToken', res.data.token);
    await cacheUser(res.data.user);
    setUser(res.data.user);
    registerForPushNotificationsAsync().then(logPushToken).catch(() => undefined);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('authToken');
    await cacheUser(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; phone?: string }) => {
    const res = await authAPI.updateProfile(data);
    await cacheUser(res.data);
    setUser(res.data);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

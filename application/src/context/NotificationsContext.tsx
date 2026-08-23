import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode,
} from 'react';
import EventSource from 'react-native-sse';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { notificationAPI, notificationStreamUrl, ApiNotification } from '../services/api';

interface NotificationsContextValue {
  notifications: ApiNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const esRef = useRef<EventSource<'notification'> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationAPI.list();
      setNotifications(res.data);
      setUnread(res.unread);
    } catch {
      // backend unreachable — leave state as-is
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try {
      await notificationAPI.markAllRead();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnread(0);
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    let es: EventSource<'notification'> | null = null;
    (async () => {
      await refresh();
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) return;
      es = new EventSource<'notification'>(notificationStreamUrl(token));
      esRef.current = es;
      es.addEventListener('notification', (event) => {
        if (!event.data) return;
        try {
          const n = JSON.parse(event.data) as ApiNotification;
          setNotifications((prev) => [n, ...prev]);
          setUnread((prev) => prev + 1);
        } catch {
          /* ignore malformed frame */
        }
      });
    })();

    return () => {
      es?.removeAllEventListeners();
      es?.close();
      esRef.current = null;
    };
  }, [isAuthenticated, refresh]);

  return (
    <NotificationsContext.Provider value={{ notifications, unread, refresh, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within <NotificationsProvider>');
  return ctx;
};

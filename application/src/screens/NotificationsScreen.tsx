import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotifications } from '../context/NotificationsContext';
import { ApiNotification } from '../services/api';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'> };

const ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  offer: 'pricetag',
  order: 'cube',
  restock: 'refresh-circle',
  general: 'notifications',
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const NotificationsScreen = ({ navigation }: Props) => {
  const { notifications, markAllRead, refresh } = useNotifications();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    refresh();
    const t = setTimeout(markAllRead, 800); // give the user a beat to see what's unread
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.iconBtn} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>Offers and order updates will show up here.</Text>
          </View>
        ) : (
          notifications.map((n: ApiNotification) => (
            <View key={n.id} style={[styles.card, !n.is_read && styles.cardUnread]}>
              <View style={styles.iconWrap}>
                <Ionicons name={ICONS[n.type] ?? 'notifications'} size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{n.title}</Text>
                  {!n.is_read && <View style={styles.dot} />}
                </View>
                {!!n.body && <Text style={styles.body}>{n.body}</Text>}
                <Text style={styles.time}>{timeAgo(n.created_at)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: COLORS.white, borderRadius: 14,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.grayBorder,
  },
  cardUnread: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryLight },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.black, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  body: { fontSize: 13, color: COLORS.gray, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, color: COLORS.gray, marginTop: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  emptySub: { fontSize: 14, color: COLORS.gray, textAlign: 'center' },
});

export default NotificationsScreen;

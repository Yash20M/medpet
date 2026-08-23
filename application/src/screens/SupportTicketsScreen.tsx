import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supportAPI, ApiSupportTicket, SupportTicketStatus } from '../services/api';
import { COLORS, GRADIENTS, RADII } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SupportTickets'> };

const STATUS_META: Record<SupportTicketStatus, { color: string; bg: string; label: string }> = {
  open: { color: COLORS.errorDark, bg: '#FEE2E2', label: 'Open' },
  pending: { color: '#B45309', bg: '#FEF3C7', label: 'Pending' },
  resolved: { color: COLORS.success, bg: '#DCFCE7', label: 'Resolved' },
  closed: { color: COLORS.gray, bg: COLORS.grayLight, label: 'Closed' },
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

const SupportTicketsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<ApiSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await supportAPI.listTickets();
      setTickets(res.data);
    } catch {
      /* keep previous state */
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { load(); });
    (async () => { setLoading(true); await load(); setLoading(false); })();
    return unsubscribe;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help &amp; Support</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NewSupportTicket')}>
            <Ionicons name="add-circle" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>Chat with our support team</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={COLORS.primary} /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No support requests yet</Text>
          <Text style={styles.emptySub}>Need help with an order or product? We're here for you.</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('NewSupportTicket')}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.newBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.newBtnText}>Start a conversation</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {tickets.map((t) => {
            const meta = STATUS_META[t.status];
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('SupportTicketDetail', { ticketId: t.id, subject: t.subject })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.subject} numberOfLines={1}>{t.subject}</Text>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {!!t.last_message && <Text style={styles.preview} numberOfLines={1}>{t.last_message}</Text>}
                <View style={styles.cardBottom}>
                  <Text style={styles.time}>{t.last_message_at ? timeAgo(t.last_message_at) : ''}</Text>
                  {t.unread_count > 0 && (
                    <View style={styles.unreadDot}><Text style={styles.unreadText}>{t.unread_count}</Text></View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: RADII.xl, borderBottomRightRadius: RADII.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, marginLeft: 4 },
  scrollContent: { padding: 20 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADII.md, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  subject: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.black },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  preview: { fontSize: 13, color: COLORS.gray, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 11, color: COLORS.gray },
  unreadDot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },
  newBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: RADII.lg },
  newBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});

export default SupportTicketsScreen;

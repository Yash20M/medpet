import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { deliveryAPI, ApiDeliveryOrder, DeliverySummary, ApiError } from '../../services/api';
import { COLORS, GRADIENTS } from '../../theme/colors';
import { DeliveryStackParamList } from '../../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<DeliveryStackParamList, 'DeliveryHome'> };

type TabKey = 'available' | 'mine';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// Address is stored as "Recipient name\nfull address" — show the address line.
const addressLine = (address: string): string => {
  if (!address) return 'No address provided';
  const parts = address.split('\n');
  return (parts.length > 1 ? parts.slice(1).join(', ') : parts[0]).trim() || 'No address provided';
};

const DeliveryHomeScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [tab, setTab] = useState<TabKey>('available');
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [available, setAvailable] = useState<ApiDeliveryOrder[]>([]);
  const [mine, setMine] = useState<ApiDeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a, m] = await Promise.all([
        deliveryAPI.summary(),
        deliveryAPI.available(),
        deliveryAPI.mine('all'),
      ]);
      setSummary(s.data);
      setAvailable(a.data);
      setMine(m.data);
    } catch {
      /* keep last-known data on transient errors */
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  // Refresh whenever the screen regains focus, and poll every 20s while open so
  // freshly-confirmed orders surface without a manual pull.
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 20_000);
      return () => clearInterval(id);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const accept = async (order: ApiDeliveryOrder) => {
    setActingId(order.id);
    try {
      await deliveryAPI.accept(order.id);
      await load();
      setTab('mine');
    } catch (err) {
      const e = err as ApiError;
      // 409 = another partner grabbed it first; refresh so it drops off the list.
      Alert.alert(e.status === 409 ? 'Just missed it' : 'Could not accept', e.message);
      await load();
    } finally {
      setActingId(null);
    }
  };

  const markDelivered = (order: ApiDeliveryOrder) => {
    Alert.alert('Mark as delivered?', `Confirm delivery of order #${order.id} to ${order.user_name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delivered',
        style: 'default',
        onPress: async () => {
          setActingId(order.id);
          try {
            await deliveryAPI.deliver(order.id);
            await load();
          } catch (err) {
            Alert.alert('Could not update', (err as ApiError).message);
            await load();
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need to sign in again to see deliveries.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { logout(); } },
    ]);
  };

  const activeMine = mine.filter((o) => o.status === 'shipped');
  const completedMine = mine.filter((o) => o.status === 'delivered');
  const list = tab === 'available' ? available : mine;

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>🚚 MedPet Partner</Text>
            <Text style={styles.greeting}>Hi {user?.name?.split(' ')[0] ?? 'Rider'} 👋</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Available" value={summary?.available ?? 0} />
          <Stat label="Active" value={summary?.active ?? 0} />
          <Stat label="Done today" value={summary?.completed_today ?? 0} />
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        <TabButton label={`Available${available.length ? ` (${available.length})` : ''}`} active={tab === 'available'} onPress={() => setTab('available')} />
        <TabButton label={`My Deliveries${activeMine.length ? ` (${activeMine.length})` : ''}`} active={tab === 'mine'} onPress={() => setTab('mine')} />
      </View>

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {tab === 'available' && available.length === 0 && (
            <EmptyBlock emoji="📭" title="No orders waiting" sub="New confirmed orders will appear here. Pull down to refresh." />
          )}

          {tab === 'available' && available.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() => navigation.navigate('DeliveryOrderDetail', { orderId: o.id })}
              action={
                <PrimaryAction
                  label="Accept order"
                  icon="checkmark-circle"
                  loading={actingId === o.id}
                  onPress={() => accept(o)}
                />
              }
            />
          ))}

          {tab === 'mine' && activeMine.length === 0 && completedMine.length === 0 && (
            <EmptyBlock emoji="🛵" title="No deliveries yet" sub="Accept an available order to start delivering." />
          )}

          {tab === 'mine' && activeMine.length > 0 && (
            <Text style={styles.sectionLabel}>Out for delivery</Text>
          )}
          {tab === 'mine' && activeMine.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() => navigation.navigate('DeliveryOrderDetail', { orderId: o.id })}
              action={
                <PrimaryAction
                  label="Mark delivered"
                  icon="checkmark-done-circle"
                  loading={actingId === o.id}
                  onPress={() => markDelivered(o)}
                />
              }
            />
          ))}

          {tab === 'mine' && completedMine.length > 0 && (
            <Text style={styles.sectionLabel}>Completed</Text>
          )}
          {tab === 'mine' && completedMine.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() => navigation.navigate('DeliveryOrderDetail', { orderId: o.id })}
              done
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────
const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const TabButton = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.8}>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const PrimaryAction = ({ label, icon, loading, onPress }: {
  label: string; icon: React.ComponentProps<typeof Ionicons>['name']; loading: boolean; onPress: () => void;
}) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress} disabled={loading} activeOpacity={0.85}>
    {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : (
      <>
        <Ionicons name={icon} size={16} color={COLORS.white} />
        <Text style={styles.actionText}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

const OrderCard = ({ order, onPress, action, done }: {
  order: ApiDeliveryOrder; onPress: () => void; action?: React.ReactNode; done?: boolean;
}) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
    <View style={styles.cardTop}>
      <Text style={styles.orderId}>Order #{order.id}</Text>
      {done
        ? <View style={[styles.pill, { backgroundColor: '#DCFCE7' }]}><Text style={[styles.pillText, { color: COLORS.success }]}>Delivered</Text></View>
        : <View style={[styles.pill, { backgroundColor: '#DBEAFE' }]}><Text style={[styles.pillText, { color: '#1D4ED8' }]}>{rupee(order.total)} · {order.payment_method.toUpperCase()}</Text></View>}
    </View>

    <View style={styles.rowLine}>
      <Ionicons name="person-outline" size={14} color={COLORS.gray} />
      <Text style={styles.rowText} numberOfLines={1}>{order.user_name}</Text>
    </View>
    <View style={styles.rowLine}>
      <Ionicons name="location-outline" size={14} color={COLORS.gray} />
      <Text style={styles.rowText} numberOfLines={2}>{addressLine(order.address)}</Text>
    </View>
    <View style={styles.rowLine}>
      <Ionicons name="cube-outline" size={14} color={COLORS.gray} />
      <Text style={styles.rowText} numberOfLines={1}>
        {order.item_count} item{order.item_count === 1 ? '' : 's'} · {order.items.map((i) => i.emoji).join(' ')}
      </Text>
    </View>

    {action && <View style={styles.cardAction}>{action}</View>}
  </TouchableOpacity>
);

const EmptyBlock = ({ emoji, title, sub }: { emoji: string; title: string; sub: string }) => (
  <View style={styles.emptyBlock}>
    <Text style={styles.emptyEmoji}>{emoji}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySub}>{sub}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.grayBorder },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  tabTextActive: { color: COLORS.white },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: COLORS.gray, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#0F2A22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  rowText: { flex: 1, fontSize: 13, color: COLORS.ink, lineHeight: 18 },
  cardAction: { marginTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12,
  },
  actionText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', paddingHorizontal: 30, lineHeight: 19 },
});

export default DeliveryHomeScreen;

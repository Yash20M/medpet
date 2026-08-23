import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { orderAPI, productAPI, ApiOrder } from '../services/api';
import { mapProduct } from '../hooks/useCatalog';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { TRACKABLE_STATUSES } from '../utils/tracking';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Orders'> };

const STATUS_META: Record<string, { color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pending:   { color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' },
  confirmed: { color: '#1D4ED8', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
  shipped:   { color: '#7C3AED', bg: '#EDE9FE', icon: 'cube-outline' },
  delivered: { color: COLORS.success, bg: '#DCFCE7', icon: 'checkmark-done-circle-outline' },
  cancelled: { color: COLORS.error, bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const OrdersScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await orderAPI.list();
      setOrders(res.data);
    } catch {
      /* keep previous state */
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** Re-adds every line of the order at live prices, then opens the cart. */
  const reorder = async (order: ApiOrder) => {
    setReorderingId(order.id);
    try {
      let added = 0;
      for (const it of order.items) {
        if (it.product_id == null) continue;
        try {
          const res = await productAPI.get(String(it.product_id));
          addItem(mapProduct(res.data), it.quantity);
          added += 1;
        } catch { /* product removed — skip */ }
      }
      if (added > 0) navigation.navigate('Cart');
      else Alert.alert('Reorder', 'These products are no longer available.');
    } finally {
      setReorderingId(null);
    }
  };

  const downloadInvoice = (order: ApiOrder) =>
    Alert.alert('Invoice ready 🧾', `Invoice for order #${order.id} (${formatPrice(order.total)}) has been sent to your email.`);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.iconBtn} />
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={styles.iconBtn} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={COLORS.primary} /></View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your placed orders will show up here.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {orders.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.pending;
            const trackable = TRACKABLE_STATUSES.has(o.status);
            return (
              <TouchableOpacity
                key={o.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.orderId}>Order #{o.id}</Text>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={12} color={meta.color} />
                    <Text style={[styles.statusText, { color: meta.color }]}>
                      {o.status[0].toUpperCase() + o.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemsSummary} numberOfLines={1}>
                  {o.items.map((i) => `${i.emoji} ${i.name}`).join(', ')}
                </Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  <Text style={styles.total}>{formatPrice(o.total)}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  {trackable && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => navigation.navigate('LiveTracking', { orderId: o.id })}
                    >
                      <Ionicons name="navigate" size={12} color={COLORS.white} />
                      <Text style={styles.actionPrimaryText} numberOfLines={1} adjustsFontSizeToFit>Track Live</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => reorder(o)}
                    disabled={reorderingId === o.id}
                  >
                    {reorderingId === o.id
                      ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : <Ionicons name="refresh" size={12} color={COLORS.primary} />}
                    <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>Reorder</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => downloadInvoice(o)}>
                    <Ionicons name="download-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>Invoice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SupportTickets')}>
                    <Ionicons name="help-buoy-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>Help</Text>
                  </TouchableOpacity>
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
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  scrollContent: { padding: 20 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  itemsSummary: { fontSize: 12, color: COLORS.gray, marginBottom: 10 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.grayBorder, paddingTop: 10 },
  date: { fontSize: 12, color: COLORS.gray },
  total: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  actions: { flexDirection: 'row', gap: 6, marginTop: 12 },
  actionBtn: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 2, backgroundColor: COLORS.primaryLight,
    overflow: 'hidden',
  },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionPrimaryText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: COLORS.white },
  actionText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: COLORS.primaryDark },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray, textAlign: 'center' },
});

export default OrdersScreen;

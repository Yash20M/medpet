import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deliveryAPI, trackingAPI, ApiDeliveryOrder, ApiError } from '../../services/api';
import { COLORS, GRADIENTS } from '../../theme/colors';
import { DeliveryStackParamList } from '../../types/navigation.types';
import { useTracking } from '../../hooks/useTracking';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import VectorMap from '../../components/tracking/VectorMap';
import { startBackgroundTracking, stopBackgroundTracking, isBackgroundTracking } from '../../services/backgroundLocation';

type Props = {
  navigation: NativeStackNavigationProp<DeliveryStackParamList, 'DeliveryOrderDetail'>;
  route: RouteProp<DeliveryStackParamList, 'DeliveryOrderDetail'>;
};

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const recipientName = (address: string): string => (address ? address.split('\n')[0] : '').trim();
const addressBody = (address: string): string => {
  if (!address) return 'No address provided';
  const parts = address.split('\n');
  return (parts.length > 1 ? parts.slice(1).join('\n') : parts[0]).trim() || 'No address provided';
};

const DeliveryOrderDetailScreen = ({ navigation, route }: Props) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<ApiDeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const isShipped = order?.status === 'shipped';
  // Live route + server-snapped position for this order (also used by the customer).
  const { state: tracking, live } = useTracking(orderId);
  // Foreground GPS sender — only broadcasts while this is an active delivery.
  const { permission, position } = useDriverLocation(orderId, !!isShipped);

  const driverPos = live ? { lat: live.lat, lng: live.lng } : position ?? tracking?.driver.location ?? null;
  const progress = live?.progress ?? tracking?.tracking.progress ?? 0;
  const eta = live?.eta ?? tracking?.tracking.etaMinutes ?? null;
  const distanceRemaining = live?.distanceRemaining ?? tracking?.tracking.distanceRemainingKm ?? null;

  const load = useCallback(async () => {
    try {
      const res = await deliveryAPI.get(orderId);
      setOrder(res.data);
    } catch {
      /* keep previous */
    }
  }, [orderId]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);

  const accept = async () => {
    if (!order) return;
    setActing(true);
    try {
      await deliveryAPI.accept(order.id);
      await load();
      Alert.alert('Order accepted', 'This delivery is now in your "My Deliveries" list.');
    } catch (err) {
      const e = err as ApiError;
      Alert.alert(e.status === 409 ? 'Just missed it' : 'Could not accept', e.message);
      await load();
    } finally {
      setActing(false);
    }
  };

  const deliver = () => {
    if (!order) return;
    Alert.alert('Mark as delivered?', `Confirm delivery of order #${order.id}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delivered', onPress: async () => {
          setActing(true);
          try {
            await deliveryAPI.deliver(order.id);
            await stopBackgroundTracking().catch(() => {});
            setBgOn(false);
            await load();
          } catch (err) {
            Alert.alert('Could not update', (err as ApiError).message);
            await load();
          } finally { setActing(false); }
        },
      },
    ]);
  };

  const [bgOn, setBgOn] = useState(false);
  useEffect(() => { isBackgroundTracking().then(setBgOn); }, []);

  const markPicked = async () => {
    if (!order) return;
    try {
      await trackingAPI.setPhase(order.id, 'picked');
      Alert.alert('Marked as picked up', 'The customer can see you’re on the way.');
    } catch (err) {
      Alert.alert('Could not update', (err as ApiError).message);
    }
  };

  const toggleBackground = async () => {
    try {
      if (bgOn) {
        await stopBackgroundTracking();
        setBgOn(false);
      } else {
        await startBackgroundTracking(orderId);
        setBgOn(true);
        Alert.alert('Background sharing on', 'Your live location is shared even when the app is in the background.');
      }
    } catch (e) {
      Alert.alert('Background location unavailable', `${(e as Error).message}\n\nNote: background tracking needs a development build (it doesn’t run in Expo Go). Foreground sharing still works.`);
    }
  };

  const callCustomer = () => {
    const phone = order?.contact_phone?.trim();
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const openMap = () => {
    if (order?.latitude == null || order?.longitude == null) return;
    const { latitude, longitude } = order;
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    })!;
    Linking.openURL(url);
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order #{orderId}</Text>
          <View style={styles.iconBtn} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : !order ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>Order unavailable</Text>
          <Text style={styles.emptySub}>It may have been taken by another partner.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
            <StatusBanner status={order.status} />

            {isShipped && (
              <View style={styles.liveCard}>
                <View style={styles.liveHead}>
                  <View style={styles.liveDotRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveLabel}>You’re live</Text>
                  </View>
                  <Text style={styles.liveMeta}>
                    {distanceRemaining != null ? `${distanceRemaining.toFixed(1)} km left` : 'Locating…'}
                    {eta != null ? ` · ${eta} min` : ''}
                  </Text>
                </View>

                <View style={styles.mapClip}>
                  <VectorMap
                    pickup={tracking?.pickup ?? null}
                    drop={tracking?.drop ?? null}
                    polyline={tracking?.route?.polyline ?? []}
                    driver={driverPos}
                    progress={progress}
                    heading={live?.heading ?? position?.heading ?? 0}
                    height={200}
                  />
                </View>

                {permission === 'denied' && (
                  <Text style={styles.locWarn}>⚠️ Enable location access to share your live position with the customer.</Text>
                )}

                <View style={styles.liveActions}>
                  <TouchableOpacity style={styles.liveBtn} onPress={markPicked}>
                    <Ionicons name="bag-check-outline" size={17} color={COLORS.primaryDark} />
                    <Text style={styles.liveBtnText}>Picked up</Text>
                  </TouchableOpacity>
                  {order.latitude != null && order.longitude != null && (
                    <TouchableOpacity style={styles.liveBtn} onPress={openMap}>
                      <Ionicons name="navigate" size={17} color={COLORS.primaryDark} />
                      <Text style={styles.liveBtnText}>Navigate</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={[styles.bgToggle, bgOn && styles.bgToggleOn]} onPress={toggleBackground}>
                  <Ionicons name={bgOn ? 'radio' : 'radio-outline'} size={16} color={bgOn ? COLORS.white : COLORS.gray} />
                  <Text style={[styles.bgToggleText, bgOn && styles.bgToggleTextOn]}>
                    {bgOn ? 'Sharing in background · tap to stop' : 'Share location in background'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Customer</Text>
              <Text style={styles.bigName}>{order.user_name}</Text>
              {!!recipientName(order.address) && recipientName(order.address) !== order.user_name && (
                <Text style={styles.subtle}>Recipient: {recipientName(order.address)}</Text>
              )}
              <View style={styles.contactRow}>
                <TouchableOpacity style={[styles.contactBtn, !order.contact_phone && styles.contactBtnDisabled]} onPress={callCustomer} disabled={!order.contact_phone}>
                  <Ionicons name="call" size={16} color={COLORS.primary} />
                  <Text style={styles.contactText}>{order.contact_phone || 'No phone'}</Text>
                </TouchableOpacity>
                {order.latitude != null && order.longitude != null && (
                  <TouchableOpacity style={styles.contactBtn} onPress={openMap}>
                    <Ionicons name="navigate" size={16} color={COLORS.primary} />
                    <Text style={styles.contactText}>Map</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Delivery address</Text>
              <Text style={styles.address}>{addressBody(order.address)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Items ({order.item_count})</Text>
              {order.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{it.emoji}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.itemQty}>×{it.quantity}</Text>
                  <Text style={styles.itemPrice}>{rupee(it.price * it.quantity)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Order total</Text>
                <Text style={styles.totalValue}>{rupee(order.total)}</Text>
              </View>
              <View style={styles.payRow}>
                <Ionicons name={order.payment_method === 'cod' ? 'cash-outline' : 'card-outline'} size={15} color={COLORS.gray} />
                <Text style={styles.payText}>
                  {order.payment_method === 'cod' ? `Collect ${rupee(order.total)} on delivery` : 'Paid online (UPI)'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {(order.status === 'confirmed' || order.status === 'shipped') && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={styles.cta}
                activeOpacity={0.85}
                disabled={acting}
                onPress={order.status === 'confirmed' ? accept : deliver}
              >
                {acting ? <ActivityIndicator color={COLORS.white} /> : (
                  <>
                    <Ionicons name={order.status === 'confirmed' ? 'checkmark-circle' : 'checkmark-done-circle'} size={20} color={COLORS.white} />
                    <Text style={styles.ctaText}>{order.status === 'confirmed' ? 'Accept order' : 'Mark delivered'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const StatusBanner = ({ status }: { status: string }) => {
  const meta: Record<string, { bg: string; color: string; text: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
    confirmed: { bg: '#DBEAFE', color: '#1D4ED8', text: 'Available to accept', icon: 'time-outline' },
    shipped:   { bg: '#EDE9FE', color: '#7C3AED', text: 'Out for delivery', icon: 'bicycle-outline' },
    delivered: { bg: '#DCFCE7', color: COLORS.success, text: 'Delivered', icon: 'checkmark-done-circle-outline' },
  };
  const m = meta[status] ?? { bg: COLORS.grayLight, color: COLORS.gray, text: status, icon: 'ellipse-outline' as const };
  return (
    <View style={[styles.banner, { backgroundColor: m.bg }]}>
      <Ionicons name={m.icon} size={18} color={m.color} />
      <Text style={[styles.bannerText, { color: m.color }]}>{m.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  scroll: { padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 14 },
  bannerText: { fontSize: 14, fontWeight: '800' },
  liveCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 12, marginBottom: 14, shadowColor: '#0F2A22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  liveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.success },
  liveLabel: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  liveMeta: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  mapClip: { borderRadius: 12, overflow: 'hidden' },
  locWarn: { fontSize: 12.5, color: COLORS.warning, fontWeight: '600', marginTop: 10 },
  liveActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  liveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 11 },
  liveBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.primaryDark },
  bgToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.grayBorder },
  bgToggleOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bgToggleText: { fontSize: 12.5, fontWeight: '700', color: COLORS.gray },
  bgToggleTextOn: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#0F2A22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  bigName: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  subtle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  contactBtnDisabled: { opacity: 0.5 },
  contactText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryDark },
  address: { fontSize: 15, color: COLORS.ink, lineHeight: 22 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  itemEmoji: { fontSize: 20 },
  itemName: { flex: 1, fontSize: 14, color: COLORS.ink },
  itemQty: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: COLORS.black, minWidth: 64, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.grayBorder, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  payText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: 'center' },
});

export default DeliveryOrderDetailScreen;

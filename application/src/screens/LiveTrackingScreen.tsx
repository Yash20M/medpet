import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, Share, Linking,
  RefreshControl,
} from 'react-native';
import { Text } from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../components/Icon';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { orderAPI, trackingAPI, ApiOrder, TrackingState } from '../services/api';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import MediaThumb from '../components/MediaThumb';
import { phaseFromStatus, estimateEta } from '../utils/tracking';
import StatusBar2 from '../components/tracking/StatusBar';
import DriverCard from '../components/tracking/DriverCard';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LiveTracking'>;
  route: RouteProp<RootStackParamList, 'LiveTracking'>;
};

const REFRESH_MS = 20_000;

const formatClock = (d: Date): string =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * Order status + estimated arrival. There is deliberately no live map: the
 * rider navigates with Google Maps, and the customer just sees a countdown
 * from the moment the rider accepted the order.
 */
const LiveTrackingScreen = ({ navigation, route }: Props) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<TrackingState | null>(null);
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Ticks so the countdown stays current between server refreshes.
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const [t, o] = await Promise.allSettled([trackingAPI.get(orderId), orderAPI.get(orderId)]);
    if (t.status === 'fulfilled') setState(t.value.data);
    if (o.status === 'fulfilled') setOrder(o.value.data);
  }, [orderId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setNow(Date.now());
    setRefreshing(false);
  };

  const status = state?.status ?? order?.status ?? 'pending';
  const delivered = status === 'delivered';
  const cancelled = status === 'cancelled';
  const phase = phaseFromStatus(status, null);
  const eta = estimateEta(state, now);
  const orderNumber = state?.orderNumber ?? `ORD-${String(orderId).padStart(4, '0')}`;

  const etaHeadline = (): string => {
    if (delivered) return 'Delivered';
    if (eta.minutesLeft == null) return 'Estimating…';
    if (status === 'shipped' && eta.minutesLeft <= 0) return 'Arriving now';
    return `${eta.minutesLeft} min`;
  };
  const etaSub = (): string => {
    if (delivered) return 'Your order has arrived.';
    if (status === 'shipped') {
      return eta.arrivalAt ? `Estimated arrival by ${formatClock(eta.arrivalAt)}` : 'Your rider is on the way.';
    }
    if (eta.minutesLeft != null) return 'Estimated trip time once your rider picks up the order.';
    return 'We’ll show your delivery time as soon as a rider accepts.';
  };

  const callDriver = (): void => {
    const phone = state?.driver.phone?.trim();
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('No number yet', 'Your rider’s contact will appear once assigned.');
  };
  const shareTracking = (): void => {
    const etaText = !delivered && status === 'shipped' && eta.arrivalAt ? ` — arriving by ${formatClock(eta.arrivalAt)}!` : '';
    Share.share({ message: `My MedPet order ${orderNumber}${etaText} 🐾` }).catch(() => {});
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Order</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={shareTracking}>
            <Ionicons name="share-social-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {!cancelled && (
          <View style={styles.etaBlock}>
            <Text style={styles.etaLabel}>{delivered ? 'Status' : 'Estimated delivery'}</Text>
            <Text style={styles.etaValue}>{etaHeadline()}</Text>
            <Text style={styles.etaSub}>{etaSub()}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        {cancelled ? (
          <View style={styles.cancelledBox}>
            <Ionicons name="close-circle" size={26} color={COLORS.error} />
            <Text style={styles.cancelledText}>This order was cancelled.</Text>
          </View>
        ) : (
          <StatusBar2 phase={phase} progress={eta.fraction} />
        )}

        <View style={styles.stripRow}>
          <Text style={styles.stripText} numberOfLines={1}>Order {orderNumber}</Text>
        </View>

        {!cancelled && status === 'shipped' && (
          <DriverCard
            name={state?.driver.name ?? null}
            vehicleNumber={state?.driver.vehicleNumber ?? null}
            vehicleType={state?.driver.vehicleType ?? null}
            phone={state?.driver.phone ?? null}
            onCall={callDriver}
            onChat={() => navigation.navigate('SupportTickets')}
          />
        )}

        {/* The code itself is only ever in the email, never re-shown in-app. */}
        {!cancelled && !delivered && status === 'shipped' && (
          <View style={styles.otpNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primaryDark} />
            <Text style={styles.otpNoteText}>
              We emailed you a delivery code — share it with your delivery partner when they arrive to confirm the handoff.
            </Text>
          </View>
        )}

        {order && (
          <View style={styles.orderCard}>
            <View style={styles.orderTop}>
              <Text style={styles.orderTitle}>Order #{order.id}</Text>
              <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
            </View>
            {order.items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <MediaThumb uri={it.image_url} emoji={it.emoji} emojiSize={22} style={styles.itemImg} rounded={10} />
                <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                <Text style={styles.itemQty}>×{it.quantity}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.detailLink} onPress={() => navigation.navigate('OrderDetail', { orderId })}>
              <Text style={styles.detailLinkText}>View full order details</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  etaBlock: { alignItems: 'center', marginTop: 18 },
  etaLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.6 },
  etaValue: { fontSize: 40, fontWeight: '900', color: COLORS.white, marginTop: 4 },
  etaSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' },
  scroll: { padding: 20, paddingTop: 18 },
  cancelledBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16 },
  cancelledText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
  stripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 },
  stripText: { fontSize: 13, fontWeight: '800', color: COLORS.black, flex: 1 },
  otpNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.md, padding: 12, marginTop: 12,
  },
  otpNoteText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.primaryDark, lineHeight: 18 },
  orderCard: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 16, marginTop: 16, ...SHADOWS.card },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderTitle: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  orderTotal: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  itemImg: { width: 36, height: 36, backgroundColor: COLORS.grayLight },
  itemName: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.black },
  itemQty: { fontSize: 12, fontWeight: '700', color: COLORS.gray },
  detailLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 8 },
  detailLinkText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});

export default LiveTrackingScreen;

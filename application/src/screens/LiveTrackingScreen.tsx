import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, StatusBar,
  Alert, Share, Dimensions, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { orderAPI, ApiOrder } from '../services/api';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import MediaThumb from '../components/MediaThumb';
import { useTracking } from '../hooks/useTracking';
import { phaseFromStatus } from '../utils/tracking';
import LeafletMap from '../components/tracking/LeafletMap';
import StatusBar2 from '../components/tracking/StatusBar';
import DriverCard from '../components/tracking/DriverCard';
import ETAChip from '../components/tracking/ETAChip';

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_H = Math.round(SCREEN_H * 0.42);
const MINI_H = 88;
const COLLAPSE_DISTANCE = MAP_H - MINI_H;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LiveTracking'>;
  route: RouteProp<RootStackParamList, 'LiveTracking'>;
};

const ConnectionPill = ({ status }: { status: 'connecting' | 'live' | 'reconnecting' }) => {
  const map = {
    live: { color: COLORS.success, label: 'Live' },
    reconnecting: { color: COLORS.warning, label: 'Reconnecting…' },
    connecting: { color: COLORS.gray, label: 'Connecting…' },
  }[status];
  return (
    <View style={styles.pill}>
      <View style={[styles.pillDot, { backgroundColor: map.color }]} />
      <Text style={styles.pillText}>{map.label}</Text>
    </View>
  );
};

const LiveTrackingScreen = ({ navigation, route }: Props) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const { state, live, connection } = useTracking(orderId);
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ target: 'drop' | 'driver' | 'route'; nonce: number } | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    orderAPI.get(orderId).then((res) => setOrder(res.data)).catch(() => {});
  }, [orderId]);

  // Drives the collapse threshold for the "expand" button, and its fade.
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const isCollapsed = value > COLLAPSE_DISTANCE * 0.6;
      setMapCollapsed((prev) => (prev !== isCollapsed ? isCollapsed : prev));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  const mapHeight = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE], outputRange: [MAP_H, MINI_H], extrapolate: 'clamp',
  });
  const expandOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.5, COLLAPSE_DISTANCE], outputRange: [0, 1], extrapolate: 'clamp',
  });
  // Map controls belong to the expanded map only — they swap out for the
  // expand affordance as the map shrinks.
  const controlsOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.5, COLLAPSE_DISTANCE], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const expandMap = (): void => scrollRef.current?.scrollTo({ y: 0, animated: true });
  const recenter = (target: 'drop' | 'driver' | 'route'): void =>
    setFocusRequest((prev) => ({ target, nonce: (prev?.nonce ?? 0) + 1 }));

  const phase = live?.phase ?? phaseFromStatus(state?.status ?? 'pending', state?.phase ?? null);
  const delivered = phase === 'delivered' || state?.status === 'delivered';
  const cancelled = state?.status === 'cancelled';

  const driverPos = live ? { lat: live.lat, lng: live.lng } : state?.driver.location ?? null;
  const progress = live?.progress ?? state?.tracking.progress ?? 0;
  const eta = live?.eta ?? state?.tracking.etaMinutes ?? state?.route?.estimatedMinutes ?? null;
  const distanceRemaining =
    live?.distanceRemaining ?? state?.tracking.distanceRemainingKm ?? state?.route?.distanceKm ?? null;
  const polyline = state?.route?.polyline ?? [];
  const hasRoute = polyline.length > 1;

  const orderNumber = state?.orderNumber ?? `AMR-${String(orderId).padStart(4, '0')}`;

  const callDriver = (): void => {
    const phone = state?.driver.phone?.trim();
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('No number yet', 'Your rider’s contact will appear once assigned.');
  };
  const shareTracking = (): void => {
    const etaText = eta != null ? ` — arriving in ~${eta} min!` : '';
    Share.share({ message: `Track my MedPet order ${orderNumber}${etaText} 🐾` }).catch(() => {});
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1220" />

      {/* Header */}
      <LinearGradient colors={GRADIENTS.night} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={shareTracking}>
            <Ionicons name="share-social-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Map — shrinks to a peek strip as the sheet below is scrolled up, Blinkit-style */}
      <Animated.View style={[styles.mapClip, { height: mapHeight }]}>
        <View style={{ height: MAP_H }}>
          <LeafletMap
            pickup={state?.pickup ?? null}
            drop={state?.drop ?? null}
            polyline={polyline}
            driver={driverPos}
            progress={progress}
            heading={live?.heading ?? 0}
            height={MAP_H}
            delivered={delivered}
            etaMinutes={eta}
            distanceRemainingKm={distanceRemaining}
            focusRequest={focusRequest}
          />
          <View style={styles.mapOverlayTop} pointerEvents="box-none">
            <ConnectionPill status={connection} />
            <ETAChip etaMinutes={eta} delivered={delivered} />
          </View>
          {!delivered && (!hasRoute || !driverPos) && (
            <View style={styles.mapHint} pointerEvents="none">
              <Ionicons name={hasRoute ? 'bicycle-outline' : 'map-outline'} size={16} color={COLORS.white} />
              <Text style={styles.mapHintText} numberOfLines={1}>
                {hasRoute
                  ? 'Your rider will appear here once assigned'
                  : 'Live map appears once your order is on the way'}
              </Text>
            </View>
          )}
        </View>

        <Animated.View
          style={[styles.expandBtnWrap, { opacity: expandOpacity }]}
          pointerEvents={mapCollapsed ? 'auto' : 'none'}
        >
          <TouchableOpacity style={styles.expandBtn} onPress={expandMap} activeOpacity={0.85}>
            <Ionicons name="expand-outline" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </Animated.View>

        {/* Map controls — recentre on the customer's doorstep, or frame the whole trip */}
        <Animated.View
          style={[styles.mapControls, { opacity: controlsOpacity }]}
          pointerEvents={mapCollapsed ? 'none' : 'auto'}
        >
          <TouchableOpacity style={styles.mapCtrlBtn} onPress={() => recenter('route')} activeOpacity={0.85}>
            <Ionicons name="scan-outline" size={18} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapCtrlBtn} onPress={() => recenter('drop')} activeOpacity={0.85}>
            <Ionicons name="home" size={17} color={COLORS.primary} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {!cancelled && (
          <View style={styles.statusWrap}>
            <StatusBar2 phase={phase} progress={progress} />
          </View>
        )}

        {cancelled && (
          <View style={styles.cancelledBox}>
            <Ionicons name="close-circle" size={26} color={COLORS.error} />
            <Text style={styles.cancelledText}>This order was cancelled.</Text>
          </View>
        )}

        {/* Order + live strip */}
        <View style={styles.stripRow}>
          <Text style={styles.stripText} numberOfLines={1}>
            Order {orderNumber}
          </Text>
          <View style={styles.stripDotRow}>
            <View style={[styles.pillDot, { backgroundColor: connection === 'live' ? COLORS.success : COLORS.warning }]} />
            <Text style={styles.stripMuted}>
              {distanceRemaining != null ? `${distanceRemaining.toFixed(1)} km left` : 'Preparing'}
            </Text>
          </View>
        </View>

        {/* Driver card */}
        {!cancelled && (
          <DriverCard
            name={state?.driver.name ?? null}
            vehicleNumber={state?.driver.vehicleNumber ?? null}
            vehicleType={state?.driver.vehicleType ?? null}
            phone={state?.driver.phone ?? null}
            onCall={callDriver}
            onChat={() => navigation.navigate('SupportTickets')}
          />
        )}

        {/* Delivery OTP reminder — the code itself is only ever in the email,
            never re-shown in-app, so this just points them to check it. */}
        {!cancelled && !delivered && state?.status === 'shipped' && (
          <View style={styles.otpNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primaryDark} />
            <Text style={styles.otpNoteText}>
              We emailed you a delivery code — share it with your delivery partner when they arrive to confirm the handoff.
            </Text>
          </View>
        )}

        {/* Order items */}
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
      </Animated.ScrollView>

      {/* Delivered celebration overlay */}
      {delivered && (
        <View style={styles.deliveredOverlay} pointerEvents="box-none">
          <View style={styles.deliveredCard}>
            <Text style={{ fontSize: 44 }}>🎉</Text>
            <Text style={styles.deliveredTitle}>Delivered!</Text>
            <Text style={styles.deliveredSub}>Your order has arrived. Thanks for shopping with MedPet.</Text>
            <TouchableOpacity style={styles.deliveredBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.deliveredBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  mapClip: { width: '100%', overflow: 'hidden', backgroundColor: '#0B1220' },
  expandBtnWrap: { position: 'absolute', bottom: 10, right: 14 },
  mapControls: { position: 'absolute', bottom: 12, right: 14, gap: 8 },
  mapCtrlBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 5,
  },
  expandBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  mapOverlayTop: {
    position: 'absolute', top: 12, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  mapHint: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  mapHintText: { color: COLORS.white, fontSize: 11.5, fontWeight: '600' },
  scroll: { padding: 20, paddingTop: 16 },
  statusWrap: { marginBottom: 16 },
  cancelledBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 16 },
  cancelledText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
  stripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  stripText: { fontSize: 13, fontWeight: '800', color: COLORS.black, flex: 1 },
  stripDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripMuted: { fontSize: 12.5, fontWeight: '700', color: COLORS.gray },
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
  deliveredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,18,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  deliveredCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 26, alignItems: 'center', width: '100%', maxWidth: 340, ...SHADOWS.floating },
  deliveredTitle: { fontSize: 22, fontWeight: '900', color: COLORS.black, marginTop: 6 },
  deliveredSub: { fontSize: 13.5, color: COLORS.gray, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  deliveredBtn: { marginTop: 18, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 40 },
  deliveredBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});

export default LiveTrackingScreen;

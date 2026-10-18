import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Text } from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../../components/Icon';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deliveryAPI, ApiDeliveryOrder, ApiError } from '../../services/api';
import { COLORS, GRADIENTS } from '../../theme/colors';
import { DeliveryStackParamList } from '../../types/navigation.types';
import DeliveryOtpModal from '../../components/delivery/DeliveryOtpModal';
import { googleMapsUrl } from '../../utils/maps';

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

  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const deliver = () => {
    if (!order) return;
    setOtpError(null);
    setOtpModalVisible(true);
  };

  const confirmDeliveryOtp = async (otp: string) => {
    if (!order) return;
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      await deliveryAPI.deliver(order.id, otp);
      setOtpModalVisible(false);
      await load();
    } catch (err) {
      setOtpError((err as ApiError).message);
    } finally {
      setOtpSubmitting(false);
    }
  };

  const callCustomer = () => {
    const phone = order?.contact_phone?.trim();
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const mapsUrl = order ? googleMapsUrl({ latitude: order.latitude, longitude: order.longitude, address: order.address }) : null;
  const openMap = () => {
    if (!mapsUrl) return;
    Linking.openURL(mapsUrl).catch(() => Alert.alert('Could not open Google Maps', 'Please install Google Maps or open the link in a browser.'));
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
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Delivery address</Text>
              <Text style={styles.address}>{addressBody(order.address)}</Text>
              {mapsUrl && (
                <TouchableOpacity style={styles.navBtn} onPress={openMap} activeOpacity={0.85}>
                  <Ionicons name="navigate" size={18} color={COLORS.white} />
                  <Text style={styles.navBtnText}>
                    {order.latitude != null && order.longitude != null ? 'Navigate in Google Maps' : 'Search address in Google Maps'}
                  </Text>
                </TouchableOpacity>
              )}
              {order.latitude != null && order.longitude != null && (
                <Text style={styles.navHint}>Uses the location the customer shared when ordering.</Text>
              )}
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

      <DeliveryOtpModal
        visible={otpModalVisible}
        orderId={order?.id ?? null}
        loading={otpSubmitting}
        error={otpError}
        onCancel={() => setOtpModalVisible(false)}
        onConfirm={confirmDeliveryOtp}
      />
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
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  scroll: { padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 14 },
  bannerText: { fontSize: 14, fontWeight: '800' },
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
  navBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A73E8', borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  navBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  navHint: { fontSize: 11.5, color: COLORS.gray, marginTop: 6, textAlign: 'center' },
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

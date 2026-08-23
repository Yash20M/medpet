import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { orderAPI, ApiOrder, OrderStatus } from '../services/api';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import MediaThumb from '../components/MediaThumb';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OrderDetail'>;
  route: RouteProp<RootStackParamList, 'OrderDetail'>;
};

const STEPS: { key: OrderStatus; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'pending', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { key: 'shipped', label: 'Shipped', icon: 'cube-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-done-circle-outline' },
];

const OrderDetailScreen = ({ navigation, route }: Props) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<ApiOrder | null>(null);

  useEffect(() => {
    orderAPI.get(orderId).then((res) => setOrder(res.data)).catch(() => {});
  }, [orderId]);

  if (!order) {
    return (
      <View style={[styles.safe, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const cancelled = order.status === 'cancelled';
  const currentStep = STEPS.findIndex((s) => s.key === order.status);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order #{order.id}</Text>
          <View style={styles.iconBtn} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {cancelled ? (
          <View style={styles.cancelledBox}>
            <Ionicons name="close-circle" size={28} color={COLORS.error} />
            <Text style={styles.cancelledText}>This order was cancelled.</Text>
          </View>
        ) : (
          <View style={styles.tracker}>
            {STEPS.map((s, i) => {
              const done = i <= currentStep;
              return (
                <View key={s.key} style={styles.trackerStep}>
                  <View style={styles.trackerIconCol}>
                    <View style={[styles.trackerDot, done && styles.trackerDotDone]}>
                      <Ionicons name={s.icon} size={16} color={done ? COLORS.white : COLORS.gray} />
                    </View>
                    {i < STEPS.length - 1 && <View style={[styles.trackerLine, done && styles.trackerLineDone]} />}
                  </View>
                  <Text style={[styles.trackerLabel, done && styles.trackerLabelDone]}>{s.label}</Text>
                </View>
              );
            })}
            {order.status !== 'delivered' && (
              <TouchableOpacity
                style={styles.liveBtn}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('LiveTracking', { orderId: order.id })}
              >
                <Ionicons name="navigate" size={15} color={COLORS.white} />
                <Text style={styles.liveBtnText}>Track Live on Map</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <MediaThumb uri={it.image_url} emoji={it.emoji} emojiSize={28} style={styles.itemImg} rounded={10} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
              <Text style={styles.itemQty}>Qty {it.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatPrice(it.price * it.quantity)}</Text>
          </View>
        ))}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>{order.delivery_fee === 0 ? 'FREE' : formatPrice(order.delivery_fee)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  scrollContent: { padding: 20 },
  cancelledBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2',
    borderRadius: 14, padding: 16, marginBottom: 20,
  },
  cancelledText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
  tracker: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 20 },
  trackerStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  trackerIconCol: { alignItems: 'center' },
  trackerDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center',
  },
  trackerDotDone: { backgroundColor: COLORS.primary },
  trackerLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: COLORS.grayBorder },
  trackerLineDone: { backgroundColor: COLORS.primary },
  trackerLabel: { fontSize: 13, color: COLORS.gray, fontWeight: '600', paddingTop: 7, paddingBottom: 17 },
  trackerLabelDone: { color: COLORS.black, fontWeight: '800' },
  liveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 11, marginTop: 6,
  },
  liveBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.black, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemImg: { width: 44, height: 44, backgroundColor: COLORS.grayLight },
  itemName: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  itemQty: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  summary: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.gray },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  summaryDivider: { height: 1, backgroundColor: COLORS.grayBorder, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
});

export default OrderDetailScreen;

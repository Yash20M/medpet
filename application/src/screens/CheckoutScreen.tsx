import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, TextInput, Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderAPI, PaymentMethod } from '../services/api';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { DELIVERY_SLOTS } from '../data/premium';
import { loadDeliveryAddress, saveDeliveryAddress } from '../utils/deliveryAddress';
import SuccessOverlay from '../components/SuccessOverlay';
import CouponOffers from '../components/CouponOffers';
import MediaThumb from '../components/MediaThumb';
import LocationPickerModal, { PickedLocation } from '../components/LocationPickerModal';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Checkout'> };

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'cod', label: 'Cash on Delivery', sub: 'Pay with cash when your order arrives', icon: 'cash-outline' },
  { value: 'upi', label: 'UPI', sub: 'Pay online via any UPI app', icon: 'phone-portrait-outline' },
];

const STEPS = [
  { key: 'address', label: 'Address', icon: 'location' as const },
  { key: 'slot', label: 'Slot', icon: 'time' as const },
  { key: 'payment', label: 'Payment', icon: 'card' as const },
  { key: 'review', label: 'Confirm', icon: 'checkmark-done' as const },
];

const buildAddress = (p: Location.LocationGeocodedAddress): string =>
  [p.name, p.street, p.district, p.city, p.region, p.postalCode]
    .filter((part, i, arr) => part && arr.indexOf(part) === i)
    .join(', ');

const CheckoutScreen = ({ navigation }: Props) => {
  const { items, itemCount, subtotal, deliveryFee, discount, total, coupon, clearCart } = useCart();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const [fullName, setFullName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [slotId, setSlotId] = useState(DELIVERY_SLOTS[0].id);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const [locating, setLocating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);

  useEffect(() => {
    Animated.spring(progress, { toValue: step, useNativeDriver: false, friction: 8, tension: 60 }).start();
  }, [step, progress]);

  // Prefill from the last order's delivery details.
  useEffect(() => {
    loadDeliveryAddress().then((saved) => {
      if (!saved) return;
      setFullName((v) => v || saved.fullName);
      setPhone((v) => v || saved.phone);
      setAddress((v) => v || saved.address);
      setPaymentMethod(saved.paymentMethod);
      if (saved.latitude != null && saved.longitude != null) {
        setCoords({ latitude: saved.latitude, longitude: saved.longitude });
      }
    });
  }, []);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Enable location access to auto-fill your delivery address, or type it in manually.'
        );
        return;
      }

      // Show a fast last-known fix immediately, then upgrade to a fresh reading.
      // The fresh fix is time-boxed so it never hangs (common on emulators / cold GPS).
      let pos = await Location.getLastKnownPositionAsync();
      try {
        const fresh = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        if (fresh) pos = fresh;
      } catch {
        /* keep the last-known fix if the fresh read fails */
      }
      if (!pos) {
        Alert.alert('Could not get location', 'Please type your delivery address manually.');
        return;
      }

      const { latitude, longitude } = pos.coords;
      setCoords({ latitude, longitude });

      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (places.length > 0) {
        const line = buildAddress(places[0]);
        if (line) setAddress(line);
      }
    } catch {
      Alert.alert('Could not get location', 'Please type your delivery address manually.');
    } finally {
      setLocating(false);
    }
  };

  /** Pin dropped on the map is the source of truth for where we deliver: its
   *  coords drive routing, and its resolved address replaces the address text. */
  const applyPickedLocation = (loc: PickedLocation): void => {
    setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    if (loc.address) setAddress(loc.address);
  };

  const validateAddress = (): boolean => {
    if (!fullName.trim()) { Alert.alert('Name required', 'Please enter the recipient name.'); return false; }
    if (!/^\d{7,15}$/.test(phone.replace(/[\s-]/g, ''))) {
      Alert.alert('Valid phone required', 'Please enter a valid contact number for delivery.');
      return false;
    }
    if (address.trim().length < 10) {
      Alert.alert('Address required', 'Please enter a complete delivery address.');
      return false;
    }
    return true;
  };

  const next = () => {
    if (step === 0 && !validateAddress()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else placeOrder();
  };

  const back = () => {
    if (step === 0) navigation.goBack();
    else setStep(step - 1);
  };

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const fullAddress = `${fullName.trim()}\n${address.trim()}`;
      const res = await orderAPI.create(
        items.map((i) => ({ productId: Number(i.product.id), quantity: i.quantity })),
        {
          address: fullAddress,
          contactPhone: phone.trim(),
          paymentMethod,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          couponCode: coupon?.code,
        }
      );
      setPlacedOrderId(res.data.id);

      await saveDeliveryAddress({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        paymentMethod,
      });

      const payLabel = paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI';
      setSuccessMsg(`${itemCount} ${itemCount === 1 ? 'item' : 'items'} (${formatPrice(total)}) • ${payLabel}.\nWe'll keep you posted on delivery.`);
      setSuccess(true);
    } catch (err) {
      Alert.alert('Could not place order', (err as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  const slot = DELIVERY_SLOTS.find((s) => s.id === slotId) ?? DELIVERY_SLOTS[0];
  const stepPct = progress.interpolate({
    inputRange: [0, STEPS.length - 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={back}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.iconBtn} />
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          <View style={styles.stepperTrack}>
            <Animated.View style={[styles.stepperFill, { width: stepPct }]} />
          </View>
          <View style={styles.stepperDots}>
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={styles.stepItem}
                  disabled={i >= step}
                  onPress={() => setStep(i)}
                >
                  <View style={[styles.stepDot, (done || active) && styles.stepDotOn]}>
                    <Ionicons name={done ? 'checkmark' : s.icon} size={13} color={done || active ? COLORS.primaryDark : 'rgba(255,255,255,0.7)'} />
                  </View>
                  <Text style={[styles.stepLabel, (done || active) && styles.stepLabelOn]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Step 0: Address ─────────────────────────────── */}
        {step === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Address</Text>

            <TouchableOpacity style={styles.locBtn} activeOpacity={0.85} onPress={useCurrentLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Ionicons name="locate" size={18} color={COLORS.primary} />
              )}
              <Text style={styles.locBtnText}>{locating ? 'Getting location…' : 'Use my current location'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pinBtn} activeOpacity={0.85} onPress={() => setShowPicker(true)}>
              <Ionicons name="map" size={18} color={COLORS.white} />
              <Text style={styles.pinBtnText}>
                {coords ? 'Adjust pin on map' : 'Drop a pin on your house'}
              </Text>
            </TouchableOpacity>

            {coords && (
              <View style={styles.coordChip}>
                <Ionicons name="location" size={13} color={COLORS.success} />
                <Text style={styles.coordText} numberOfLines={1}>
                  Location pinned ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})
                </Text>
              </View>
            )}

            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Recipient name" placeholderTextColor={COLORS.gray} />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Contact number for delivery" placeholderTextColor={COLORS.gray} keyboardType="phone-pad" />

            <Text style={styles.label}>Full Address</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={address}
              onChangeText={setAddress}
              placeholder="House / flat no., street, area, city, pincode"
              placeholderTextColor={COLORS.gray}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {coords && (
              <Text style={styles.addrHint}>
                Add your house / flat no. above so the rider finds you faster.
              </Text>
            )}
          </View>
        )}

        {/* ── Step 1: Delivery slot ───────────────────────── */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Slot</Text>
            {DELIVERY_SLOTS.map((s) => {
              const selected = slotId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.slotRow, selected && styles.slotRowSelected]}
                  activeOpacity={0.85}
                  onPress={() => setSlotId(s.id)}
                >
                  <View style={[styles.slotIcon, s.express && { backgroundColor: COLORS.secondaryLight }]}>
                    <Ionicons name={s.express ? 'flash' : 'time-outline'} size={18} color={s.express ? COLORS.secondaryDark : COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.slotLabel, selected && { color: COLORS.primary }]}>{s.label}</Text>
                      {s.express && <View style={styles.expressPill}><Text style={styles.expressText}>FASTEST</Text></View>}
                    </View>
                    <Text style={styles.slotWindow}>{s.window}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? COLORS.primary : COLORS.grayBorder}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Step 2: Payment ─────────────────────────────── */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Method</Text>
            {PAYMENT_OPTIONS.map((opt) => {
              const selected = paymentMethod === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.payRow, selected && styles.payRowSelected]}
                  activeOpacity={0.85}
                  onPress={() => setPaymentMethod(opt.value)}
                >
                  <Ionicons name={opt.icon} size={22} color={selected ? COLORS.primary : COLORS.gray} />
                  <View style={styles.payInfo}>
                    <Text style={[styles.payLabel, selected && { color: COLORS.primary }]}>{opt.label}</Text>
                    <Text style={styles.paySub}>{opt.sub}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? COLORS.primary : COLORS.grayBorder}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Step 3: Review & confirm ────────────────────── */}
        {step === 3 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Items</Text>
              {items.map(({ product, quantity }) => (
                <View key={product.id} style={styles.reviewItem}>
                  <MediaThumb uri={product.imageUrl} emoji={product.emoji} emojiSize={22} style={styles.reviewImg} rounded={10} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.reviewName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.reviewQty}>Qty {quantity}</Text>
                  </View>
                  <Text style={styles.reviewPrice}>{formatPrice(product.price * quantity)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.recapRow}>
                <Ionicons name="location" size={16} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recapTitle}>{fullName} · {phone}</Text>
                  <Text style={styles.recapSub} numberOfLines={2}>{address}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(0)}><Text style={styles.recapEdit}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapRow}>
                <Ionicons name={slot.express ? 'flash' : 'time-outline'} size={16} color={COLORS.secondaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recapTitle}>{slot.label} · {slot.window}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(1)}><Text style={styles.recapEdit}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapRow}>
                <Ionicons name="card-outline" size={16} color={COLORS.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recapTitle}>{paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(2)}><Text style={styles.recapEdit}>Edit</Text></TouchableOpacity>
              </View>
            </View>

            {/* Offers & coupons */}
            <CouponOffers />

            {/* Order summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</Text>
                <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={styles.summaryValue}>{deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Coupon {coupon ? `(${coupon.code})` : ''}</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.primary }]}>−{formatPrice(discount)}</Text>
                </View>
              )}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(total)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.footerLabel}>Payable</Text>
          <Text style={styles.footerTotal}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={next} disabled={placing}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {placing ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Text style={styles.ctaText}>{step < STEPS.length - 1 ? 'Continue' : 'Place Order'}</Text>
                <Ionicons name={step < STEPS.length - 1 ? 'arrow-forward' : 'checkmark-circle'} size={18} color={COLORS.white} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <LocationPickerModal
        visible={showPicker}
        initial={coords}
        onClose={() => setShowPicker(false)}
        onConfirm={applyPickedLocation}
      />

      <SuccessOverlay
        visible={success}
        title="Order placed! 🐾"
        message={successMsg}
        ctaLabel="Track my order"
        onDone={() => {
          setSuccess(false);
          clearCart();
          if (placedOrderId != null) {
            navigation.replace('LiveTracking', { orderId: placedOrderId });
          } else {
            navigation.navigate('Main', { screen: 'Home' });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  stepper: { marginTop: 14 },
  stepperTrack: {
    position: 'absolute', top: 14, left: 30, right: 30, height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2,
  },
  stepperFill: { height: '100%', backgroundColor: COLORS.white, borderRadius: 2 },
  stepperDots: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', width: 64 },
  stepDot: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  stepDotOn: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  stepLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 4 },
  stepLabelOn: { color: COLORS.white, fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 12 },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, marginBottom: 6,
  },
  locBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  pinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, marginTop: 8,
  },
  pinBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  coordChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  coordText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.gray, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 14, color: COLORS.black, backgroundColor: COLORS.white,
  },
  textarea: { height: 92, paddingTop: 10 },
  addrHint: { fontSize: 11, color: COLORS.gray, marginTop: 6, lineHeight: 15 },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  slotRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  slotIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  slotLabel: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  slotWindow: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  expressPill: { backgroundColor: COLORS.secondaryDark, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  expressText: { fontSize: 8, fontWeight: '800', color: COLORS.white },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  payRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  payInfo: { flex: 1 },
  payLabel: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  paySub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  reviewItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewImg: { width: 40, height: 40, backgroundColor: COLORS.grayLight },
  reviewName: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  reviewQty: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  reviewPrice: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  recapTitle: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  recapSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  recapEdit: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  recapDivider: { height: 1, backgroundColor: COLORS.grayBorder, marginVertical: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.gray },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  summaryDivider: { height: 1, backgroundColor: COLORS.grayBorder, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  footerLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  footerTotal: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  cta: { borderRadius: 16, overflow: 'hidden' },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 16 },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});

export default CheckoutScreen;

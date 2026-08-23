import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { couponAPI, ApiCouponEligibility } from '../services/api';
import { formatPrice } from '../types/product.types';
import { COLORS, RADII, SHADOWS } from '../theme/colors';
import PressableScale from './PressableScale';

/** Shared "available offers" block — used on both Cart and Checkout so the
 *  applied coupon and discount stay consistent across screens. */
const CouponOffers = () => {
  const { items, coupon, applyCoupon, removeCoupon } = useCart();
  const [eligible, setEligible] = useState<ApiCouponEligibility[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (items.length === 0) { setEligible([]); return; }
    let active = true;
    setLoading(true);
    couponAPI.eligible(items.map((i) => ({ productId: Number(i.product.id), quantity: i.quantity })))
      .then((res) => { if (active) setEligible(res.data); })
      .catch(() => { if (active) setEligible([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.product.id}:${i.quantity}`).join(',')]);

  const apply = async (couponCode: string) => {
    setApplying(true);
    try {
      await applyCoupon(couponCode);
      setCode('');
    } catch (err) {
      Alert.alert('Could not apply coupon', (err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Offers &amp; Coupons</Text>

      {coupon ? (
        <View style={styles.appliedChip}>
          <Ionicons name="pricetag" size={16} color={COLORS.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.appliedCode}>{coupon.code} applied</Text>
            <Text style={styles.appliedSub}>You saved {formatPrice(coupon.discount)}</Text>
          </View>
          <PressableScale onPress={removeCoupon} haptic={false}>
            <Text style={styles.removeText}>Remove</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 8 }} />}

          {!loading && eligible.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {eligible.map((e) => (
                <View key={e.coupon.code} style={styles.offerCard}>
                  <Text style={styles.offerCode}>{e.coupon.code}</Text>
                  <Text style={styles.offerTitle} numberOfLines={2}>{e.coupon.title}</Text>
                  <Text style={styles.offerSavings}>Save {formatPrice(e.discount)}</Text>
                  <PressableScale onPress={() => apply(e.coupon.code)} disabled={applying} style={styles.offerBtn}>
                    <Text style={styles.offerBtnText}>{applying ? 'Applying…' : 'Apply'}</Text>
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.manualRow}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="Enter coupon code"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="characters"
            />
            <PressableScale
              onPress={() => code.trim() && apply(code.trim())}
              disabled={!code.trim() || applying}
              style={styles.applyBtn}
            >
              {applying ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.applyBtnText}>Apply</Text>}
            </PressableScale>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 16, marginBottom: 16, ...SHADOWS.card,
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 12 },
  appliedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.md, padding: 12, borderWidth: 1, borderColor: COLORS.primary,
  },
  appliedCode: { fontSize: 14, fontWeight: '800', color: COLORS.primaryDark },
  appliedSub: { fontSize: 12, color: COLORS.primaryDark, marginTop: 1 },
  removeText: { fontSize: 12, fontWeight: '700', color: COLORS.errorDark },
  offerCard: {
    width: 150, borderRadius: RADII.md, padding: 12, borderWidth: 1.5, borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.background,
  },
  offerCode: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  offerTitle: { fontSize: 12, color: COLORS.gray, marginTop: 2, minHeight: 32 },
  offerSavings: { fontSize: 13, fontWeight: '700', color: COLORS.black, marginTop: 6 },
  offerBtn: {
    marginTop: 8, backgroundColor: COLORS.primary, borderRadius: RADII.sm,
    paddingVertical: 7, alignItems: 'center',
  },
  offerBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  manualRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADII.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.black,
  },
  applyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADII.sm, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});

export default CouponOffers;

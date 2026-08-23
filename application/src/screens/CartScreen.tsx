import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '../context/CartContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import MediaThumb from '../components/MediaThumb';
import EmptyState from '../components/EmptyState';
import CouponOffers from '../components/CouponOffers';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Cart'> };

const FREE_DELIVERY_OVER = 499;

const CartScreen = ({ navigation }: Props) => {
  const { items, itemCount, subtotal, deliveryFee, discount, total, coupon, updateQty, removeItem } = useCart();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const [giftCode, setGiftCode] = useState('');

  const freeDeliveryGap = Math.max(0, FREE_DELIVERY_OVER - subtotal);
  const freeDeliveryPct = Math.min(100, Math.round((subtotal / FREE_DELIVERY_OVER) * 100));

  const redeemGiftCard = () => {
    if (!giftCode.trim()) return;
    Alert.alert('Gift Cards', 'Gift card redemption is launching soon — your code has been noted! 🎁');
    setGiftCode('');
  };

  // Checkout requires an account; once signed in, collect delivery + payment details.
  const handleCheckout = () => requireAuth(() => navigation.navigate('Checkout'));

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.iconBtn} />
          <Text style={styles.headerTitle}>My Cart</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.headerSub}>
          {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} in your cart` : 'Your cart is empty'}
        </Text>
      </LinearGradient>

      {items.length === 0 ? (
        <EmptyState
          emoji="🛒"
          title="Your cart is waiting for some treats"
          subtitle="Looks like you haven't added anything yet. Let's fix that! 🐾"
          ctaLabel="Browse Products"
          onCta={() => navigation.navigate('ProductList', { title: 'All Products' })}
        />
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {items.map(({ product, quantity }) => (
              <View key={product.id} style={styles.itemCard}>
                <MediaThumb uri={product.imageUrl} emoji={product.emoji} emojiSize={36} style={styles.itemImg} rounded={12} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemBrand}>{product.brand}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.itemPrice}>{formatPrice(product.price)}</Text>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => removeItem(product.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.gray} />
                  </TouchableOpacity>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(product.id, -1)}>
                      <Ionicons name="remove" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(product.id, 1)}>
                      <Ionicons name="add" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            {/* Free-delivery progress */}
            <View style={styles.freeDelivery}>
              {freeDeliveryGap > 0 ? (
                <Text style={styles.freeDeliveryText}>
                  Add <Text style={styles.freeDeliveryBold}>{formatPrice(freeDeliveryGap)}</Text> more for FREE delivery 🚚
                </Text>
              ) : (
                <Text style={styles.freeDeliveryText}>🎉 You've unlocked <Text style={styles.freeDeliveryBold}>FREE delivery</Text></Text>
              )}
              <View style={styles.freeDeliveryBar}>
                <View style={[styles.freeDeliveryFill, { width: `${freeDeliveryPct}%` }]} />
              </View>
            </View>

            <CouponOffers />

            {/* Gift card */}
            <View style={styles.giftCard}>
              <Ionicons name="gift-outline" size={18} color={COLORS.purple} />
              <TextInput
                style={styles.giftInput}
                value={giftCode}
                onChangeText={setGiftCode}
                placeholder="Have a gift card?"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.giftBtn, !giftCode.trim() && { opacity: 0.5 }]}
                onPress={redeemGiftCard}
                disabled={!giftCode.trim()}
              >
                <Text style={styles.giftBtnText}>Redeem</Text>
              </TouchableOpacity>
            </View>

            {/* Estimated delivery */}
            <View style={styles.etaCard}>
              <View style={styles.etaIcon}><Text style={{ fontSize: 20 }}>🛵</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.etaTitle}>Estimated delivery</Text>
                <Text style={styles.etaSub}>Today, within 2 hours of ordering</Text>
              </View>
              <View style={styles.etaPill}><Text style={styles.etaPillText}>Express</Text></View>
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
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
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerTotal}>{formatPrice(total)}</Text>
            </View>
            <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={handleCheckout}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.ctaText}>Proceed to Checkout</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
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
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, marginLeft: 4 },
  scrollContent: { padding: 20 },
  itemCard: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  itemImg: { width: 72, height: 72, borderRadius: 12, backgroundColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center' },
  itemEmoji: { fontSize: 36 },
  itemInfo: { flex: 1, paddingHorizontal: 12, justifyContent: 'center' },
  itemBrand: { fontSize: 10, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemName: { fontSize: 14, fontWeight: '700', color: COLORS.black, marginVertical: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  itemActions: { alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 15, fontWeight: '800', color: COLORS.black, minWidth: 18, textAlign: 'center' },
  freeDelivery: {
    backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  freeDeliveryText: { fontSize: 12, color: COLORS.primaryDark, marginBottom: 8 },
  freeDeliveryBold: { fontWeight: '800' },
  freeDeliveryBar: { height: 6, borderRadius: 3, backgroundColor: '#D1FAE5', overflow: 'hidden' },
  freeDeliveryFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },
  giftCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.purpleLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  giftInput: { flex: 1, fontSize: 13, color: COLORS.black, paddingVertical: 4 },
  giftBtn: { backgroundColor: COLORS.purpleLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  giftBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.purpleDark },
  etaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  etaIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.secondaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  etaTitle: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  etaSub: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  etaPill: { backgroundColor: COLORS.secondaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  etaPillText: { fontSize: 10, fontWeight: '800', color: COLORS.secondaryDark },
  summary: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.gray },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  summaryDivider: { height: 1, backgroundColor: COLORS.grayBorder, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  footerLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  footerTotal: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  cta: { borderRadius: 16, overflow: 'hidden' },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 16 },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },
  browseBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  browseText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});

export default CartScreen;

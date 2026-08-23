import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { usePets } from '../context/PetsContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { getProductById } from '../data/products';
import { productAPI, recommendationAPI } from '../services/api';
import { mapProduct } from '../hooks/useCatalog';
import { Product, formatPrice } from '../types/product.types';
import { getProductInfo } from '../data/premium';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { PET_TYPE_LABEL } from '../types/pet.types';
import MediaThumb from '../components/MediaThumb';
import PressableScale from '../components/PressableScale';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 0.88);

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
  route: RouteProp<RootStackParamList, 'ProductDetail'>;
};

type InfoTab = 'ingredients' | 'usage' | 'dosage' | 'sideEffects';

const INFO_TABS: { key: InfoTab; label: string }[] = [
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'usage', label: 'Usage' },
  { key: 'dosage', label: 'Dosage' },
  { key: 'sideEffects', label: 'Side Effects' },
];

const ProductDetailScreen = ({ navigation, route }: Props) => {
  const { productId } = route.params;
  // Seed from local mock so the screen renders instantly, then refresh from API.
  const [product, setProduct] = useState<Product | null>(() => getProductById(productId) ?? null);
  const { itemCount, addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { primaryPet } = usePets();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const [qty, setQty] = useState(1);
  const [related, setRelated] = useState<Product[]>([]);
  const [infoTab, setInfoTab] = useState<InfoTab>('ingredients');
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    setQty(1);
    productAPI.get(productId)
      .then((res) => { if (active) setProduct(mapProduct(res.data)); })
      .catch(() => { /* keep mock fallback */ });
    recommendationAPI.related(productId, 8)
      .then((res) => { if (active) setRelated(res.data.map(mapProduct)); })
      .catch(() => { if (active) setRelated([]); });
    return () => { active = false; };
  }, [productId]);

  // Gentle vertical float on the hero image ("3D floating" feel).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  if (!product) {
    return (
      <View style={[styles.safe, styles.centered]}>
        <Text style={styles.notFound}>Product not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const info = getProductInfo(product.id);
  const discount = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );
  const heroLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const bundle = related.slice(0, 2);
  const bundleTotal = product.price + bundle.reduce((a, p) => a + p.price, 0);

  const handleAddToCart = () => {
    addItem(product, qty);
    navigation.navigate('Main', { screen: 'Cart' });
  };

  const addBundle = () => {
    addItem(product);
    bundle.forEach((p) => addItem(p));
    navigation.navigate('Main', { screen: 'Cart' });
  };

  const infoBody = (): React.ReactNode => {
    if (infoTab === 'ingredients') {
      return (
        <View style={{ gap: 8 }}>
          {info.ingredients.map((ing) => (
            <View key={ing} style={styles.ingRow}>
              <View style={styles.ingDot} />
              <Text style={styles.infoText}>{ing}</Text>
            </View>
          ))}
        </View>
      );
    }
    const text = infoTab === 'usage' ? info.usage : infoTab === 'dosage' ? info.dosage : info.sideEffects;
    return <Text style={styles.infoText}>{text}</Text>;
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.hero}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: heroLift }] }]}>
          <MediaThumb uri={product.imageUrl} emoji={product.emoji} emojiSize={140} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* Scrim so the floating controls stay legible over any photo. */}
        <LinearGradient colors={['rgba(0,0,0,0.28)', 'transparent']} style={styles.heroScrim} pointerEvents="none" />

        <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => requireAuth(() => toggle(product), 'Login')}>
              <Ionicons
                name={isWishlisted(product.id) ? 'heart' : 'heart-outline'}
                size={22}
                color={isWishlisted(product.id) ? COLORS.primary : COLORS.black}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Main', { screen: 'Cart' })}>
              <Ionicons name="cart-outline" size={22} color={COLORS.black} />
              {itemCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{itemCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {discount > 0 && (
          <View style={styles.heroDiscount}><Text style={styles.heroDiscountText}>{discount}% OFF</Text></View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name}>{product.name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>{product.rating}</Text>
            <Text style={styles.reviewText}>· {product.reviews} reviews</Text>
          </View>
          <View style={[styles.stockPill, { backgroundColor: product.inStock ? '#DCFCE7' : '#FEE2E2' }]}>
            <Text style={[styles.stockText, { color: product.inStock ? COLORS.success : COLORS.error }]}>
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          <Text style={styles.oldPrice}>{formatPrice(product.originalPrice)}</Text>
          {discount > 0 && (
            <View style={styles.discountTag}><Text style={styles.discountText}>{discount}% OFF</Text></View>
          )}
        </View>

        {/* Delivery ETA + Rx badges */}
        <View style={styles.perkRow}>
          <View style={styles.perk}>
            <Ionicons name="flash" size={15} color={COLORS.secondaryDark} />
            <Text style={styles.perkText}>Delivery in 18 min</Text>
          </View>
          <View style={styles.perk}>
            <Ionicons name="shield-checkmark" size={15} color={COLORS.primary} />
            <Text style={styles.perkText}>100% Genuine</Text>
          </View>
          <View style={styles.perk}>
            <Ionicons name="repeat" size={15} color={COLORS.purple} />
            <Text style={styles.perkText}>Easy Returns</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>

        {/* Info tabs */}
        <View style={styles.tabsRow}>
          {INFO_TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, infoTab === t.key && styles.tabActive]}
              onPress={() => setInfoTab(t.key)}
            >
              <Text
                style={[styles.tabText, infoTab === t.key && styles.tabTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.infoCard}>{infoBody()}</View>

        <Text style={styles.sectionTitle}>Quantity</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Ionicons name="remove" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
            <Ionicons name="add" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Frequently bought together */}
        {bundle.length > 0 && (
          <View style={styles.bundleSection}>
            <Text style={styles.sectionTitle}>Frequently Bought Together</Text>
            <View style={styles.bundleCard}>
              <View style={styles.bundleRow}>
                <View style={styles.bundleImg}>
                  <MediaThumb uri={product.imageUrl} emoji={product.emoji} emojiSize={28} style={StyleSheet.absoluteFill} rounded={RADII.sm} />
                </View>
                {bundle.map((p) => (
                  <React.Fragment key={p.id}>
                    <Ionicons name="add" size={16} color={COLORS.gray} />
                    <View style={styles.bundleImg}>
                      <MediaThumb uri={p.imageUrl} emoji={p.emoji} emojiSize={28} style={StyleSheet.absoluteFill} rounded={RADII.sm} />
                    </View>
                  </React.Fragment>
                ))}
                <View style={{ flex: 1 }} />
                <View>
                  <Text style={styles.bundleLabel}>Bundle price</Text>
                  <Text style={styles.bundlePrice}>{formatPrice(bundleTotal)}</Text>
                </View>
              </View>
              <PressableScale style={styles.bundleBtn} onPress={addBundle} scaleTo={0.96}>
                <LinearGradient colors={GRADIENTS.sky} style={styles.bundleBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="cart" size={15} color={COLORS.white} />
                  <Text style={styles.bundleBtnText}>Add all {bundle.length + 1} items</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          </View>
        )}

        {related.length > 0 && (
          <View style={styles.recSection}>
            <Text style={styles.sectionTitle}>
              {primaryPet ? `Recommended for your ${PET_TYPE_LABEL[primaryPet.type]}` : 'You might also like'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}
            >
              {related.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.recCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.push('ProductDetail', { productId: r.id })}
                >
                  <View style={styles.recImg}>
                    <MediaThumb uri={r.imageUrl} emoji={r.emoji} emojiSize={40} style={StyleSheet.absoluteFill} rounded={RADII.md} />
                  </View>
                  <Text style={styles.recName} numberOfLines={2}>{r.name}</Text>
                  <View style={styles.recPriceRow}>
                    <Text style={styles.recPrice}>{formatPrice(r.price)}</Text>
                    <TouchableOpacity style={styles.recAdd} onPress={() => addItem(r)}>
                      <Ionicons name="add" size={16} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>{formatPrice(product.price * qty)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.cta, !product.inStock && styles.ctaDisabled]}
          disabled={!product.inStock}
          activeOpacity={0.9}
          onPress={handleAddToCart}
        >
          <LinearGradient
            colors={product.inStock ? GRADIENTS.primary : ['#CBD5E1', '#94A3B8']}
            style={styles.ctaGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Ionicons name="cart" size={18} color={COLORS.white} />
            <Text style={styles.ctaText}>{product.inStock ? 'Add to Cart' : 'Unavailable'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  notFound: { fontSize: 16, color: COLORS.black, fontWeight: '600' },
  backLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
  hero: {
    width: '100%', height: HERO_H, backgroundColor: COLORS.primaryLight,
    borderBottomLeftRadius: RADII.xl, borderBottomRightRadius: RADII.xl, overflow: 'hidden',
  },
  heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  headerRow: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.card,
  },
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  heroDiscount: {
    position: 'absolute', bottom: 16, left: 16, backgroundColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.pill, ...SHADOWS.floating,
  },
  heroDiscountText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 20 },
  brand: { fontSize: 12, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  name: { fontSize: 24, fontWeight: '800', color: COLORS.black, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  reviewText: { fontSize: 13, color: COLORS.gray },
  stockPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stockText: { fontSize: 12, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  price: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  oldPrice: { fontSize: 16, color: COLORS.gray, textDecorationLine: 'line-through' },
  discountTag: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  discountText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  perkRow: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white,
    borderRadius: RADII.md, padding: 12, marginBottom: 20, ...SHADOWS.card,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perkText: { fontSize: 10, fontWeight: '700', color: COLORS.black },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.gray, lineHeight: 22, marginBottom: 22 },
  tabsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tab: {
    flex: 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 2, borderRadius: RADII.pill, backgroundColor: COLORS.white,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.grayBorder, overflow: 'hidden',
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { flexShrink: 1, fontSize: 10, fontWeight: '700', color: COLORS.gray },
  tabTextActive: { color: COLORS.white },
  infoCard: { backgroundColor: COLORS.white, borderRadius: RADII.md, padding: 14, marginBottom: 22, ...SHADOWS.card },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  infoText: { fontSize: 13, color: COLORS.gray, lineHeight: 20 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  qtyBtn: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 18, fontWeight: '800', color: COLORS.black, minWidth: 24, textAlign: 'center' },
  bundleSection: { marginTop: 26 },
  bundleCard: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 14, ...SHADOWS.card },
  bundleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bundleImg: { width: 52, height: 52, borderRadius: RADII.sm, backgroundColor: COLORS.grayLight, overflow: 'hidden' },
  bundleLabel: { fontSize: 10, color: COLORS.gray, fontWeight: '600', textAlign: 'right' },
  bundlePrice: { fontSize: 17, fontWeight: '800', color: COLORS.secondaryDark, textAlign: 'right' },
  bundleBtn: { borderRadius: RADII.md, overflow: 'hidden' },
  bundleBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  bundleBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  recSection: { marginTop: 28 },
  recCard: { width: 140, backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 10, ...SHADOWS.card },
  recImg: { height: 90, borderRadius: RADII.md, backgroundColor: COLORS.grayLight, overflow: 'hidden', marginBottom: 8 },
  recName: { fontSize: 12, fontWeight: '700', color: COLORS.black, lineHeight: 16, minHeight: 32 },
  recPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  recPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  recAdd: {
    width: 28, height: 28, borderRadius: RADII.sm, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  footerLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  footerTotal: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  cta: { borderRadius: 16, overflow: 'hidden' },
  ctaDisabled: { opacity: 0.8 },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 16 },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});

export default ProductDetailScreen;

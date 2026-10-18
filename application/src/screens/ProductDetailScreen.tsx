import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Animated, Easing, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Text } from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../components/Icon';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { usePets } from '../context/PetsContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { getProductById } from '../data/products';
import { productAPI, recommendationAPI } from '../services/api';
import { mapProduct } from '../hooks/useCatalog';
import { Product, ProductVariant, formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { PET_TYPE_LABEL, PET_TYPE_PLURAL, PET_EMOJI, PetType } from '../types/pet.types';
import MediaThumb from '../components/MediaThumb';
import HeartButton from '../components/HeartButton';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 0.88);

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
  route: RouteProp<RootStackParamList, 'ProductDetail'>;
};

type Section = 'description' | 'manufacturer' | 'additional' | 'reviews';

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
  const [variantId, setVariantId] = useState<string | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const [slide, setSlide] = useState(0);
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    setQty(1);
    setVariantId(null);
    setSlide(0);
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

  const variants = product.variants ?? [];
  // Default to the first size that is in stock (or the first size) until the shopper picks one.
  const selected: ProductVariant | undefined =
    variants.find((v) => v.id === variantId) ?? variants.find((v) => v.stockQuantity > 0) ?? variants[0];
  const price = selected?.price ?? product.price;
  const originalPrice = selected?.originalPrice ?? product.originalPrice;
  const inStock = selected ? product.inStock && selected.stockQuantity > 0 : product.inStock;
  const discount = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const heroLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  const handleAddToCart = () => {
    addItem(product, qty, selected);
    navigation.navigate('Main', { screen: 'Cart' });
  };

  const gallery = product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setSlide(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
  const toggleSection = (k: Section) => setOpenSection((cur) => (cur === k ? null : k));

  const Accordion = ({ k, icon, title, children }: { k: Section; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; children: React.ReactNode }) => {
    const open = openSection === k;
    return (
      <View style={styles.accItem}>
        <TouchableOpacity style={styles.accHead} activeOpacity={0.7} onPress={() => toggleSection(k)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Ionicons name={icon} size={20} color={COLORS.gray} />
          <Text style={styles.accTitle}>{title}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.black} />
        </TouchableOpacity>
        {open && <View style={styles.accBody}>{children}</View>}
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.hero}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: heroLift }] }]}>
          {gallery.length > 1 ? (
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onGalleryScroll} scrollEventThrottle={16}
            >
              {gallery.map((u, i) => (
                <View key={u + i} style={{ width: SCREEN_W, height: HERO_H }}>
                  <MediaThumb uri={u} emoji={product.emoji} emojiSize={140} style={StyleSheet.absoluteFill} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <MediaThumb uri={gallery[0] ?? product.imageUrl} emoji={product.emoji} emojiSize={140} style={StyleSheet.absoluteFill} />
          )}
        </Animated.View>
        {gallery.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {gallery.map((u, i) => <View key={u + i} style={[styles.dot, i === slide && styles.dotOn]} />)}
          </View>
        )}
        {/* Scrim so the floating controls stay legible over any photo. */}
        <LinearGradient colors={['rgba(0,0,0,0.28)', 'transparent']} style={styles.heroScrim} pointerEvents="none" />

        <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <HeartButton style={styles.iconBtn} active={isWishlisted(product.id)} onPress={() => requireAuth(() => toggle(product), 'Login')} size={22} />
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
        {product.isFeatured && (
          <View style={styles.heroFeatured} accessibilityLabel="Featured product">
            <Ionicons name="star" size={13} color={COLORS.white} />
            <Text style={styles.heroFeaturedText}>Featured</Text>
          </View>
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
          <View style={[styles.stockPill, { backgroundColor: inStock ? '#DCFCE7' : '#FEE2E2' }]}>
            <Text style={[styles.stockText, { color: inStock ? COLORS.success : COLORS.error }]}>
              {inStock ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(price)}</Text>
          <Text style={styles.oldPrice}>{formatPrice(originalPrice)}</Text>
          {discount > 0 && (
            <View style={styles.discountTag}><Text style={styles.discountText}>{discount}% OFF</Text></View>
          )}
        </View>

        {variants.length > 0 && (
          <View style={styles.sizeSection}>
            <Text style={styles.sectionTitle}>Select size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeRow}>
              {variants.map((v) => {
                const on = v.id === selected?.id;
                const off = v.stockQuantity <= 0;
                const pct = v.originalPrice > 0 ? Math.round(((v.originalPrice - v.price) / v.originalPrice) * 100) : 0;
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.85}
                    onPress={() => setVariantId(v.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.sizeCard, on && styles.sizeCardOn, off && styles.sizeCardOff]}
                  >
                    <Text style={[styles.sizeLabel, on && styles.sizeLabelOn]}>{v.label}</Text>
                    <View style={styles.sizePriceRow}>
                      <Text style={styles.sizePrice}>{formatPrice(v.price)}</Text>
                      {pct > 0 && <Text style={styles.sizePct}>{pct}% OFF</Text>}
                    </View>
                    {v.originalPrice > v.price && <Text style={styles.sizeMrp}>MRP {formatPrice(v.originalPrice)}</Text>}
                    {off && <Text style={styles.sizeSold}>Out of stock</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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

        <View style={styles.accGroup}>
          <Accordion k="description" icon="document-text" title="Product Description">
            <Text style={styles.infoText}>{product.description || 'No description available.'}</Text>
            {product.isAccessory ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.suitTitle}>Suitable for</Text>
                <View style={styles.suitRow}>
                  {(product.petTypes ?? []).length === 0 ? (
                    <View style={[styles.suitChip, styles.suitChipAll]}><Text style={styles.suitChipText}>🐾 All pets</Text></View>
                  ) : (
                    (product.petTypes ?? []).map((t) => (
                      <View key={t} style={[styles.suitChip, primaryPet?.type === t && styles.suitChipMine]}>
                        <Text style={styles.suitChipText}>{PET_EMOJI[t as PetType] ?? '🐾'} {PET_TYPE_PLURAL[t as PetType] ?? t}</Text>
                      </View>
                    ))
                  )}
                </View>
                {!!primaryPet && (product.petTypes ?? []).length > 0 && (
                  <Text style={styles.suitNote}>
                    {(product.petTypes ?? []).includes(primaryPet.type)
                      ? `✓ A great fit for ${primaryPet.name}`
                      : `Not specifically made for ${PET_TYPE_PLURAL[primaryPet.type].toLowerCase()}`}
                  </Text>
                )}
              </View>
            ) : null}
          </Accordion>
          <Accordion k="manufacturer" icon="business" title="Manufacturer Details">
            {product.manufacturerDetails ? (
              <Text style={styles.infoText}>{product.manufacturerDetails}</Text>
            ) : (
              <>
                <View style={styles.mfrRow}><Text style={styles.mfrKey}>Brand</Text><Text style={styles.mfrVal}>{product.brand || '—'}</Text></View>
                <View style={styles.mfrRow}><Text style={styles.mfrKey}>Category</Text><Text style={styles.mfrVal}>{product.category || '—'}</Text></View>
                <View style={styles.mfrRow}><Text style={styles.mfrKey}>Sold by</Text><Text style={styles.mfrVal}>MedPet</Text></View>
              </>
            )}
          </Accordion>
          {!!(product.ingredients || product.uses) && (
            <Accordion k="additional" icon="list" title="Additional Details">
              {!!product.ingredients && (
                <View>
                  <Text style={styles.infoHeading}>Ingredients</Text>
                  <Text style={styles.infoText}>{product.ingredients}</Text>
                </View>
              )}
              {!!product.uses && (
                <View style={product.ingredients ? { marginTop: 14 } : undefined}>
                  <Text style={styles.infoHeading}>Uses</Text>
                  <Text style={styles.infoText}>{product.uses}</Text>
                </View>
              )}
            </Accordion>
          )}
          <Accordion k="reviews" icon="chatbubble-ellipses" title="Product Reviews">
            <View style={styles.revRow}>
              <Text style={styles.revScore}>{product.rating}</Text>
              <View>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons key={n} name={n <= Math.round(Number(product.rating)) ? 'star' : 'star-outline'} size={16} color="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.reviewText}>Based on {product.reviews} reviews</Text>
              </View>
            </View>
          </Accordion>
        </View>

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
          <Text style={styles.footerTotal}>{formatPrice(price * qty)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.cta, !inStock && styles.ctaDisabled]}
          disabled={!inStock}
          activeOpacity={0.9}
          onPress={handleAddToCart}
        >
          <LinearGradient
            colors={inStock ? GRADIENTS.primary : ['#CBD5E1', '#94A3B8']}
            style={styles.ctaGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Ionicons name="cart" size={18} color={COLORS.white} />
            <Text style={styles.ctaText}>{inStock ? 'Add to Cart' : 'Unavailable'}</Text>
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
  heroFeatured: {
    position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.pill, ...SHADOWS.card,
  },
  heroFeaturedText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
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
  sizeSection: { marginBottom: 16 },
  sizeRow: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  sizeCard: {
    minWidth: 112, backgroundColor: COLORS.white, borderRadius: RADII.md, padding: 12,
    borderWidth: 1.5, borderColor: COLORS.grayBorder, ...SHADOWS.card,
  },
  sizeCardOn: { borderColor: COLORS.secondaryDark, backgroundColor: '#E0F2FE' },
  sizeCardOff: { opacity: 0.55 },
  sizeLabel: { fontSize: 14, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  sizeLabelOn: { color: COLORS.secondaryDark },
  sizePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sizePrice: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  sizePct: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  sizeMrp: { fontSize: 11, color: COLORS.gray, marginTop: 3 },
  sizeSold: { fontSize: 11, fontWeight: '700', color: COLORS.error, marginTop: 3 },
  dots: { position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.25)' },
  dotOn: { backgroundColor: COLORS.black, width: 9, height: 9, borderRadius: 5 },
  accGroup: { marginTop: 26, backgroundColor: COLORS.white, borderRadius: RADII.md, overflow: 'hidden', ...SHADOWS.card },
  accItem: { borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  accTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.black },
  accBody: { paddingHorizontal: 16, paddingBottom: 16 },
  infoHeading: { fontSize: 13, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  mfrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  mfrKey: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  mfrVal: { fontSize: 13, color: COLORS.black, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  revRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  revScore: { fontSize: 34, fontWeight: '800', color: COLORS.black },
  perkRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 8,
    backgroundColor: COLORS.white, borderRadius: RADII.md, padding: 12, marginBottom: 20, ...SHADOWS.card,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
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
  suitTitle: { fontSize: 13, fontWeight: '800', color: COLORS.black, marginBottom: 10 },
  suitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suitChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADII.pill,
    backgroundColor: COLORS.grayLight, borderWidth: 1.5, borderColor: 'transparent',
  },
  suitChipAll: { backgroundColor: COLORS.primaryLight },
  suitChipMine: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  suitChipText: { fontSize: 12.5, fontWeight: '700', color: COLORS.black },
  suitNote: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark, marginTop: 10 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  infoText: { fontSize: 13, color: COLORS.gray, lineHeight: 20 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  qtyBtn: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 18, fontWeight: '800', color: COLORS.black, minWidth: 24, textAlign: 'center' },
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

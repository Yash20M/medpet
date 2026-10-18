import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from './Icon';
import PressableScale from './PressableScale';
import FadeInView from './FadeInView';
import HeartButton from './HeartButton';
import MediaThumb from './MediaThumb';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { Product, formatPrice } from '../types/product.types';
import { petsLabel } from '../utils/accessories';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';

interface Props {
  product: Product;
  width: number;
  onPress: () => void;
  /** Entrance-animation stagger. */
  index?: number;
}

/** Accessory tile used on Home and the Accessories page: photo, "for which pets", price, add-to-cart. */
const AccessoryCard = ({ product: p, width, onPress, index = 0 }: Props) => {
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const requireAuth = useRequireAuth();
  const discount = p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;

  return (
    <FadeInView delay={index * 60} distance={18}>
      <PressableScale style={[styles.card, { width }]} scaleTo={0.97} onPress={onPress} accessibilityLabel={`${p.name}, ${formatPrice(p.price)}`}>
        <View style={styles.img}>
          <MediaThumb uri={p.imageUrl} emoji={p.emoji} emojiSize={54} style={StyleSheet.absoluteFill} />
          {discount > 0 && (
            <View style={styles.discount}><Text style={styles.discountText}>{discount}% OFF</Text></View>
          )}
          <HeartButton style={styles.heart} active={isWishlisted(p.id)} onPress={() => requireAuth(() => toggle(p), 'Login')} />
        </View>
        <View style={styles.info}>
          <View style={styles.forPill}>
            <Ionicons name="paw" size={10} color={COLORS.primaryDark} />
            <Text style={styles.forText} numberOfLines={1}>{petsLabel(p.petTypes)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(p.price)}</Text>
            {p.originalPrice > p.price && <Text style={styles.oldPrice}>{formatPrice(p.originalPrice)}</Text>}
          </View>
          {!p.inStock && <Text style={styles.oos}>Out of stock</Text>}
          <PressableScale style={styles.addBtn} onPress={() => addItem(p)} disabled={!p.inStock} scaleTo={0.93}>
            <LinearGradient
              colors={p.inStock ? GRADIENTS.primary : ['#CBD5E1', '#94A3B8']}
              style={styles.addGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add" size={16} color={COLORS.white} />
              <Text style={styles.addText}>Add</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </PressableScale>
    </FadeInView>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 18, overflow: 'hidden', ...SHADOWS.card },
  img: { backgroundColor: COLORS.grayLight, height: 118, alignItems: 'center', justifyContent: 'center' },
  discount: {
    position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.accent,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, zIndex: 1,
  },
  discountText: { color: COLORS.white, fontSize: 9.5, fontWeight: '800' },
  heart: {
    position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.card,
  },
  info: { padding: 12 },
  forPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%',
    backgroundColor: COLORS.primaryLight, borderRadius: RADII.pill, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  forText: { flexShrink: 1, fontSize: 10, fontWeight: '800', color: COLORS.primaryDark },
  name: { fontSize: 13, fontWeight: '700', color: COLORS.black, lineHeight: 18, height: 36, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  price: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  oldPrice: { fontSize: 12, color: COLORS.gray, textDecorationLine: 'line-through' },
  oos: { fontSize: 10, color: COLORS.errorDark, fontWeight: '700', marginBottom: 6 },
  addBtn: { borderRadius: 10, overflow: 'hidden' },
  addGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7 },
  addText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
});

export default AccessoryCard;

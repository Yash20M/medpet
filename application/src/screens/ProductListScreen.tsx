import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCategories, useProducts } from '../hooks/useCatalog';
import { Product, formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import MediaThumb from '../components/MediaThumb';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProductList'>;
  route: RouteProp<RootStackParamList, 'ProductList'>;
};

const { width } = Dimensions.get('window');
const RAIL_W = 72;
const GRID_PAD = 10;
const COL_GAP = 10;
const CARD_W = (width - RAIL_W - GRID_PAD * 2 - COL_GAP) / 2;

const ProductListScreen = ({ navigation, route }: Props) => {
  const { category, title } = route.params ?? {};
  const { items, itemCount, addItem, updateQty } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const { data: categories } = useCategories();
  const { data: allProducts } = useProducts();

  const [active, setActive] = useState<string>(category ?? 'All');
  const [search, setSearch] = useState('');

  const rail = [{ id: 'all', icon: '🛍️', label: 'All', imageUrl: undefined as string | undefined }, ...categories];

  const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.quantity ?? 0;

  const products = allProducts.filter((p) => {
    const inCat = active === 'All' || p.category === active;
    const q = search.trim().toLowerCase();
    const inSearch = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
    return inCat && inSearch;
  });

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* ─── Header ─────────────────────────────── */}
      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title ?? 'All Products'}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Main', { screen: 'Cart' })}>
            <Ionicons name="cart-outline" size={24} color={COLORS.white} />
            {itemCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{itemCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for pet products..."
            placeholderTextColor={COLORS.gray}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ─── Body: category rail + product grid ───── */}
      <View style={styles.body}>
        {/* Left rail */}
        <View style={styles.railCol}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {rail.map((c) => {
              const isActive = active === c.label;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.railItem}
                  activeOpacity={0.7}
                  onPress={() => setActive(c.label)}
                >
                  {isActive && <View style={styles.railActiveBar} />}
                  <View style={[styles.railIconBg, isActive && styles.railIconBgActive]}>
                    <MediaThumb uri={c.imageUrl} emoji={c.icon} emojiSize={24} style={StyleSheet.absoluteFill} rounded={14} />
                  </View>
                  <Text style={[styles.railLabel, isActive && styles.railLabelActive]} numberOfLines={1}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right grid */}
        <View style={styles.gridCol}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: GRID_PAD, paddingBottom: insets.bottom + 24 }}
          >
            <Text style={styles.resultCount}>
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </Text>

            {products.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🐾</Text>
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySub}>Try a different category or search.</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    qty={qtyOf(p.id)}
                    wishlisted={isWishlisted(p.id)}
                    onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                    onAdd={() => addItem(p)}
                    onInc={() => updateQty(p.id, 1)}
                    onDec={() => updateQty(p.id, -1)}
                    onToggleWishlist={() => requireAuth(() => toggle(p), 'Login')}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

/* ─── Blinkit-style product card ──────────────── */
interface CardProps {
  product: Product;
  qty: number;
  wishlisted: boolean;
  onPress: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  onToggleWishlist: () => void;
}

const ProductCard = ({ product: p, qty, wishlisted, onPress, onAdd, onInc, onDec, onToggleWishlist }: CardProps) => {
  const discount = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.cardImgWrap}>
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}%</Text>
            <Text style={styles.discountText}>OFF</Text>
          </View>
        )}
        <MediaThumb uri={p.imageUrl} emoji={p.emoji} emojiSize={52} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={styles.cardHeartBtn} onPress={onToggleWishlist} hitSlop={6}>
          <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={15} color={wishlisted ? COLORS.primary : COLORS.gray} />
        </TouchableOpacity>

        {/* ADD / stepper — Blinkit signature control */}
        <View style={styles.addWrap}>
          {!p.inStock ? (
            <View style={styles.oosBtn}><Text style={styles.oosText}>Sold out</Text></View>
          ) : qty === 0 ? (
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={onAdd}>
              <Text style={styles.addText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={onDec} hitSlop={6}>
                <Ionicons name="remove" size={16} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={styles.stepQty}>{qty}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={onInc} hitSlop={6}>
                <Ionicons name="add" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.deliveryPill}>
        <Ionicons name="flash" size={10} color={COLORS.gray} />
        <Text style={styles.deliveryText}>12 MINS</Text>
      </View>

      <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
      <Text style={styles.cardBrand} numberOfLines={1}>{p.brand}</Text>

      <View style={styles.cardPriceRow}>
        <Text style={styles.cardPrice}>{formatPrice(p.price)}</Text>
        {discount > 0 && <Text style={styles.cardOldPrice}>{formatPrice(p.originalPrice)}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { position: 'relative', padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.white, marginHorizontal: 8 },
  badge: {
    position: 'absolute', top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: COLORS.black, fontSize: 10, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.black },

  body: { flex: 1, flexDirection: 'row' },

  /* Left category rail */
  railCol: { width: RAIL_W, backgroundColor: COLORS.white, borderRightWidth: 1, borderRightColor: COLORS.grayBorder },
  railItem: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, position: 'relative' },
  railActiveBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: COLORS.primary },
  railIconBg: { width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  railIconBgActive: { backgroundColor: COLORS.primaryLight, borderWidth: 1.5, borderColor: COLORS.primary },
  railEmoji: { fontSize: 24 },
  railLabel: { fontSize: 10, fontWeight: '600', color: COLORS.gray, textAlign: 'center' },
  railLabelActive: { color: COLORS.primary, fontWeight: '800' },

  /* Right grid */
  gridCol: { flex: 1 },
  resultCount: { fontSize: 12, color: COLORS.gray, fontWeight: '600', marginBottom: 10, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COL_GAP },

  card: {
    width: CARD_W, backgroundColor: COLORS.white, borderRadius: 14, padding: 8,
    borderWidth: 1, borderColor: COLORS.grayBorder,
  },
  cardImgWrap: {
    height: 104, borderRadius: 10, backgroundColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 10,
  },
  cardEmoji: { fontSize: 52 },
  cardHeartBtn: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute', top: 0, left: 0, backgroundColor: COLORS.primary,
    paddingHorizontal: 5, paddingVertical: 3, borderTopLeftRadius: 10, borderBottomRightRadius: 10, alignItems: 'center',
  },
  discountText: { color: COLORS.white, fontSize: 8, fontWeight: '800', lineHeight: 10 },
  addWrap: { position: 'absolute', bottom: -10, right: 6 },
  addBtn: {
    backgroundColor: COLORS.primaryLight, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 8, paddingHorizontal: 18, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  addText: { color: COLORS.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  stepQty: { color: COLORS.white, fontSize: 13, fontWeight: '800', minWidth: 16, textAlign: 'center' },
  oosBtn: { backgroundColor: COLORS.grayLight, borderWidth: 1, borderColor: COLORS.grayBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  oosText: { color: COLORS.gray, fontSize: 11, fontWeight: '700' },

  deliveryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    backgroundColor: COLORS.grayLight, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 5,
  },
  deliveryText: { fontSize: 9, color: COLORS.gray, fontWeight: '700', letterSpacing: 0.3 },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.black, lineHeight: 17, marginBottom: 2 },
  cardBrand: { fontSize: 11, color: COLORS.gray, marginBottom: 8 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardPrice: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  cardOldPrice: { fontSize: 11, color: COLORS.gray, textDecorationLine: 'line-through' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: 'center' },
});

export default ProductListScreen;

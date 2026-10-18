import React, { useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import FadeInView from '../components/FadeInView';
import HeartButton from '../components/HeartButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../components/Icon';
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
import SortSheet from '../components/SortSheet';
import FilterSheet from '../components/FilterSheet';
import PressableScale from '../components/PressableScale';
import { PET_TYPE_PLURAL, PetType } from '../types/pet.types';
import {
  SortKey, DEFAULT_SORT, sortLabel, sortShortLabel, sortProducts, Filters, EMPTY_FILTERS, activeFilterCount,
  applyFilters, makePetTypesOf, PRICE_BUCKETS,
} from '../utils/productFilters';

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
  const { category, title, featured: featuredOnly, brandId, brand } = route.params ?? {};
  const { items, itemCount, addItem, updateQty } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const { data: categories } = useCategories();
  // `featured` = opened from Home's Featured Products "See all": list every featured product.
  const { data: allProducts } = useProducts(
    featuredOnly ? { featured: true } : brandId || brand ? { brandId, brand } : undefined
  );

  const [active, setActive] = useState<string>(category ?? 'All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const rail = [{ id: 'all', icon: '🛍️', label: 'All', imageUrl: undefined as string | undefined }, ...categories];

  const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.quantity ?? 0;

  // Category rail + search narrow the list first; the filter sheet counts options from this set.
  const base = useMemo(() => allProducts.filter((p) => {
    const inCat = active === 'All' || p.category === active;
    const q = search.trim().toLowerCase();
    const inSearch = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
    return inCat && inSearch;
  }), [allProducts, active, search]);

  const petTypesOf = useMemo(() => makePetTypesOf(categories), [categories]);
  const products = useMemo(
    () => sortProducts(applyFilters(base, filters, petTypesOf), sort),
    [base, filters, petTypesOf, sort]
  );
  const filterCount = activeFilterCount(filters);
  const sortChanged = sort !== DEFAULT_SORT;
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // One removable chip per applied filter.
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.brands.map((b) => ({ key: `b:${b}`, label: b, remove: () => setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) })) })),
    ...filters.petTypes.map((t) => ({ key: `t:${t}`, label: PET_TYPE_PLURAL[t as PetType] ?? t, remove: () => setFilters((f) => ({ ...f, petTypes: f.petTypes.filter((x) => x !== t) })) })),
    ...filters.prices.map((id) => ({ key: `p:${id}`, label: PRICE_BUCKETS.find((b) => b.id === id)?.label ?? id, remove: () => setFilters((f) => ({ ...f, prices: f.prices.filter((x) => x !== id) })) })),
    ...(filters.minDiscount > 0 ? [{ key: 'd', label: `${filters.minDiscount}% & above`, remove: () => setFilters((f) => ({ ...f, minDiscount: 0 })) }] : []),
    ...(filters.minRating > 0 ? [{ key: 'r', label: `${filters.minRating}★ & above`, remove: () => setFilters((f) => ({ ...f, minRating: 0 })) }] : []),
    ...(filters.inStockOnly ? [{ key: 's', label: 'In stock', remove: () => setFilters((f) => ({ ...f, inStockOnly: false })) }] : []),
  ];

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

      {/* ─── Sort + Filter bar ─────────────────────── */}
      <View style={styles.toolbar}>
        <View style={styles.toolRow}>
          <PressableScale
            style={[styles.toolBtn, sortChanged && styles.toolBtnOn]}
            onPress={() => setSortOpen(true)}
            scaleTo={0.96}
            haptic={false}
            accessibilityLabel={`Sort by ${sortLabel(sort)}`}
          >
            <Ionicons name="swap-vertical" size={16} color={sortChanged ? COLORS.primaryDark : COLORS.ink} />
            <Text style={[styles.toolText, sortChanged && styles.toolTextOn]} numberOfLines={1}>
              {sortChanged ? `Sort: ${sortShortLabel(sort)}` : 'Sort'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={sortChanged ? COLORS.primaryDark : COLORS.gray} />
          </PressableScale>

          <PressableScale
            style={[styles.toolBtn, filterCount > 0 && styles.toolBtnOn]}
            onPress={() => setFilterOpen(true)}
            scaleTo={0.96}
            haptic={false}
            accessibilityLabel={filterCount ? `Filters, ${filterCount} applied` : 'Filters'}
          >
            <Ionicons name="options-outline" size={16} color={filterCount ? COLORS.primaryDark : COLORS.ink} />
            <Text style={[styles.toolText, filterCount > 0 && styles.toolTextOn]}>Filters</Text>
            {filterCount > 0 && <View style={styles.toolBadge}><Text style={styles.toolBadgeText}>{filterCount}</Text></View>}
          </PressableScale>
        </View>

        {chips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {chips.map((c) => (
              <TouchableOpacity key={c.key} style={styles.chip} onPress={c.remove} activeOpacity={0.7} accessibilityLabel={`Remove ${c.label} filter`}>
                <Text style={styles.chipText} numberOfLines={1}>{c.label}</Text>
                <Ionicons name="close" size={13} color={COLORS.primaryDark} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={clearFilters} hitSlop={8} style={styles.chipClear}>
              <Text style={styles.chipClearText}>Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

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
                <Text style={styles.emptySub}>
                  {filterCount > 0 ? 'No product matches your filters.' : 'Try a different category or search.'}
                </Text>
                {filterCount > 0 && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={clearFilters} activeOpacity={0.85}>
                    <Text style={styles.emptyBtnText}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // key replays the entrance animation when the order / filters change
              <View key={`${sort}|${active}|${JSON.stringify(filters)}`} style={styles.grid}>
                {products.map((p, idx) => (
                  <FadeInView key={p.id} delay={(idx % 6) * 60} distance={20}>
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
                  </FadeInView>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <SortSheet visible={sortOpen} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />
      <FilterSheet
        visible={filterOpen}
        base={base}
        petTypesOf={petTypesOf}
        value={filters}
        onApply={setFilters}
        onClose={() => setFilterOpen(false)}
      />
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
        <HeartButton style={styles.cardHeartBtn} active={wishlisted} onPress={onToggleWishlist} size={15} />

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

  toolbar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder, paddingVertical: 10 },
  toolRow: { flexDirection: 'row', gap: 10, paddingHorizontal: GRID_PAD + 2 },
  toolBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 40,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.white, paddingHorizontal: 10,
  },
  toolBtnOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  toolText: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: COLORS.ink },
  toolTextOn: { color: COLORS.primaryDark, fontWeight: '800' },
  toolBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  toolBadgeText: { color: COLORS.white, fontSize: 10.5, fontWeight: '800' },
  chipRow: { gap: 8, paddingHorizontal: GRID_PAD + 2, paddingTop: 10, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 200, height: 32, paddingHorizontal: 11,
    borderRadius: 16, backgroundColor: COLORS.primaryLight,
  },
  chipText: { flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: COLORS.primaryDark },
  chipClear: { paddingHorizontal: 6, height: 32, justifyContent: 'center' },
  chipClearText: { fontSize: 12.5, fontWeight: '800', color: COLORS.errorDark },
  emptyBtn: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: COLORS.white, fontSize: 13.5, fontWeight: '800' },
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
    position: 'absolute', top: 0, left: 0, zIndex: 2, backgroundColor: COLORS.primary,
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

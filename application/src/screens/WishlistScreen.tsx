import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../types/product.types';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import MediaThumb from '../components/MediaThumb';
import EmptyState from '../components/EmptyState';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Wishlist'> };

const WishlistScreen = ({ navigation }: Props) => {
  const { items, toggle } = useWishlist();
  const { addItem } = useCart();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Wishlist</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.headerSub}>{items.length} saved item{items.length === 1 ? '' : 's'}</Text>
      </LinearGradient>

      {items.length === 0 ? (
        <EmptyState
          emoji="🐾"
          title="Your wishlist is empty"
          subtitle="Tap the heart on any product to save it here for later."
          ctaLabel="Browse Products"
          onCta={() => navigation.navigate('ProductList', { title: 'All Products' })}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
          {items.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.itemCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
            >
              <MediaThumb uri={p.imageUrl} emoji={p.emoji} emojiSize={32} style={styles.itemImg} rounded={12} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemBrand}>{p.brand}</Text>
                <Text style={styles.itemName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.itemPrice}>{formatPrice(p.price)}</Text>
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity onPress={() => toggle(p)} hitSlop={8}>
                  <Ionicons name="heart" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addToCartBtn}
                  disabled={!p.inStock}
                  onPress={() => addItem(p)}
                >
                  <Ionicons name="cart-outline" size={16} color={p.inStock ? COLORS.white : COLORS.gray} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  itemImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: COLORS.grayLight },
  itemInfo: { flex: 1, paddingHorizontal: 12, justifyContent: 'center' },
  itemBrand: { fontSize: 10, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemName: { fontSize: 14, fontWeight: '700', color: COLORS.black, marginVertical: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  itemActions: { alignItems: 'center', justifyContent: 'space-between' },
  addToCartBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },
  browseBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  browseText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});

export default WishlistScreen;

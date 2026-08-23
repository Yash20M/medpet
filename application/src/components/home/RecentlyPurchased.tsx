import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../PressableScale';
import MediaThumb from '../MediaThumb';
import SectionHeader from '../SectionHeader';
import { orderAPI, productAPI, ApiOrderItem } from '../../services/api';
import { mapProduct } from '../../hooks/useCatalog';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../types/product.types';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface RecentItem {
  productId: number;
  name: string;
  emoji: string;
  imageUrl: string | null;
  price: number;
}

/** "Buy again" carousel built from the user's past orders — one-tap reorder
 *  fetches the live product (fresh price/stock) before adding to cart. */
const RecentlyPurchased = () => {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setItems([]); return; }
    let active = true;
    orderAPI.list()
      .then((res) => {
        if (!active) return;
        const seen = new Set<number>();
        const recent: RecentItem[] = [];
        for (const order of res.data) {
          for (const it of order.items as ApiOrderItem[]) {
            if (it.product_id == null || seen.has(it.product_id)) continue;
            seen.add(it.product_id);
            recent.push({
              productId: it.product_id, name: it.name, emoji: it.emoji,
              imageUrl: it.image_url ?? null, price: it.price,
            });
            if (recent.length >= 8) break;
          }
          if (recent.length >= 8) break;
        }
        setItems(recent);
      })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [isAuthenticated]);

  const reorder = useCallback(async (productId: number) => {
    setAddingId(productId);
    try {
      const res = await productAPI.get(String(productId));
      addItem(mapProduct(res.data));
    } catch {
      /* product may have been removed — silently ignore */
    } finally {
      setAddingId(null);
    }
  }, [addItem]);

  if (items.length === 0) return null;

  return (
    <View>
      <SectionHeader title="Buy Again" subtitle="From your past orders" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}>
        {items.map((it) => (
          <View key={it.productId} style={styles.card}>
            <View style={styles.imgWrap}>
              <MediaThumb uri={it.imageUrl} emoji={it.emoji} emojiSize={32} style={StyleSheet.absoluteFill} rounded={RADII.md} />
            </View>
            <Text style={styles.name} numberOfLines={2}>{it.name}</Text>
            <View style={styles.bottomRow}>
              <Text style={styles.price}>{formatPrice(it.price)}</Text>
              <PressableScale style={styles.reorderBtn} scaleTo={0.88} onPress={() => reorder(it.productId)}>
                {addingId === it.productId
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Ionicons name="refresh" size={15} color={COLORS.white} />}
              </PressableScale>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { width: 128, backgroundColor: COLORS.white, borderRadius: RADII.md, padding: 10, ...SHADOWS.card },
  imgWrap: { height: 72, borderRadius: RADII.md, backgroundColor: COLORS.grayLight, overflow: 'hidden', marginBottom: 8 },
  name: { fontSize: 11, fontWeight: '700', color: COLORS.black, lineHeight: 15, minHeight: 30 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  price: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  reorderBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default RecentlyPurchased;

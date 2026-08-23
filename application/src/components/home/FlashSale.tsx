import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import MediaThumb from '../MediaThumb';
import { Product, formatPrice } from '../../types/product.types';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  products: Product[];
  onProduct: (id: string) => void;
  /** Admin-set sale end (ISO). Absent/past → rolling 6-hour window. */
  endsAt?: string | null;
}

/** Fallback deal window resets every 6 hours so the countdown is always live. */
const WINDOW_MS = 6 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

const useCountdown = (endsAt?: string | null): string => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = endsAt ? new Date(endsAt).getTime() : NaN;
  const remaining = Number.isFinite(target) && target > now
    ? target - now
    : WINDOW_MS - (now % WINDOW_MS);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/** Percentage of "stock claimed" — deterministic per product so bars differ. */
const claimedPct = (id: string): number => {
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 7);
  return 35 + (seed % 50);
};

const FlashSale = ({ products, onProduct, endsAt }: Props) => {
  const countdown = useCountdown(endsAt);
  if (products.length === 0) return null;

  return (
    <LinearGradient colors={['#FFF7ED', '#FFEDD5']} style={styles.wrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.bolt}>⚡</Text>
          <Text style={styles.title}>Flash Sale</Text>
        </View>
        <View style={styles.timer}>
          <Ionicons name="time" size={13} color={COLORS.white} />
          <Text style={styles.timerText}>{countdown}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {products.map((p) => {
          const pct = claimedPct(p.id);
          const off = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
          return (
            <PressableScale key={p.id} style={styles.card} onPress={() => onProduct(p.id)} scaleTo={0.95}>
              <View style={styles.imgWrap}>
                <MediaThumb uri={p.imageUrl} emoji={p.emoji} emojiSize={38} style={StyleSheet.absoluteFill} rounded={RADII.md} />
                {off > 0 && <View style={styles.offBadge}><Text style={styles.offText}>-{off}%</Text></View>}
              </View>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPrice(p.price)}</Text>
                <Text style={styles.oldPrice}>{formatPrice(p.originalPrice)}</Text>
              </View>
              <View style={styles.stockBar}>
                <LinearGradient
                  colors={['#F97316', '#EA580C']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.stockFill, { width: `${pct}%` }]}
                />
              </View>
              <Text style={styles.stockText}>{pct}% claimed</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  wrap: { borderRadius: RADII.lg, padding: 14, ...SHADOWS.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bolt: { fontSize: 18 },
  title: { fontSize: 17, fontWeight: '800', color: '#9A3412' },
  timer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EA580C', borderRadius: RADII.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  timerText: { color: COLORS.white, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  card: { width: 128, backgroundColor: COLORS.white, borderRadius: RADII.md, padding: 10, ...SHADOWS.card },
  imgWrap: { height: 76, borderRadius: RADII.md, backgroundColor: COLORS.grayLight, overflow: 'hidden', marginBottom: 8 },
  offBadge: {
    position: 'absolute', top: 6, left: 6, backgroundColor: '#EA580C',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  offText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  name: { fontSize: 11, fontWeight: '700', color: COLORS.black },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, marginBottom: 7 },
  price: { fontSize: 13, fontWeight: '800', color: '#EA580C' },
  oldPrice: { fontSize: 10, color: COLORS.gray, textDecorationLine: 'line-through' },
  stockBar: { height: 5, borderRadius: 3, backgroundColor: '#FED7AA', overflow: 'hidden' },
  stockFill: { height: '100%', borderRadius: 3 },
  stockText: { fontSize: 9, color: '#9A3412', fontWeight: '700', marginTop: 4 },
});

export default FlashSale;

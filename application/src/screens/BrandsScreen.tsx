import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../components/Icon';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { contentAPI, ApiBrand } from '../services/api';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import MediaThumb from '../components/MediaThumb';
import EmptyState from '../components/EmptyState';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Brands'> };

const GUTTER = 20;
const GAP = 12;

/** "See all" for Popular Brands: every brand that has products, searchable. Tapping one lists its products. */
const BrandsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await contentAPI.brands();
      setBrands(res.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cols = width >= 600 ? 4 : 3;
  const cardW = Math.floor((width - GUTTER * 2 - GAP * (cols - 1)) / cols);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;
  }, [brands, query]);

  const open = (b: ApiBrand) => navigation.navigate('ProductList', { title: b.name, brandId: b.id });

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Brands</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search brands..."
            placeholderTextColor={COLORS.gray}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : failed && brands.length === 0 ? (
        <EmptyState
          emoji="📡"
          title="Couldn't load brands"
          subtitle="Check your connection and try again."
          ctaLabel="Retry"
          onCta={() => { setLoading(true); load().finally(() => setLoading(false)); }}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        >
          {shown.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>{brands.length === 0 ? 'No brands yet' : 'No brands found'}</Text>
              <Text style={styles.emptySub}>
                {brands.length === 0 ? 'Brands will appear here soon.' : 'Try a different name.'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.count}>{shown.length} brand{shown.length === 1 ? '' : 's'}</Text>
              <View style={styles.grid}>
                {shown.map((b, i) => (
                  <FadeInView key={b.id} delay={(i % 9) * 50} distance={14}>
                    <PressableScale style={[styles.card, { width: cardW }]} onPress={() => open(b)} scaleTo={0.94} accessibilityLabel={`${b.name}, ${b.product_count} products`}>
                      <MediaThumb
                        uri={b.image_url}
                        emoji={b.emoji}
                        emojiSize={30}
                        rounded={32}
                        style={[styles.logo, { backgroundColor: b.tint }]}
                      />
                      <Text style={styles.name} numberOfLines={2}>{b.name}</Text>
                      <Text style={styles.items}>{b.product_count} item{b.product_count === 1 ? '' : 's'}</Text>
                    </PressableScale>
                  </FadeInView>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: GUTTER, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white,
    borderRadius: RADII.md, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.black },
  scroll: { padding: GUTTER },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12, fontWeight: '700', color: COLORS.gray, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: {
    alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADII.md,
    paddingVertical: 14, paddingHorizontal: 6, minHeight: 138, ...SHADOWS.card,
  },
  logo: { width: 64, height: 64, borderRadius: 32, marginBottom: 10 },
  name: { fontSize: 12.5, fontWeight: '800', color: COLORS.black, textAlign: 'center', lineHeight: 16 },
  items: { fontSize: 11, color: COLORS.gray, marginTop: 3, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
});

export default BrandsScreen;

import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCategories } from '../hooks/useCatalog';
import { QUICK_LINKS } from '../data/products';
import MediaThumb from '../components/MediaThumb';
import PressableScale from '../components/PressableScale';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Categories'> };

const { width } = Dimensions.get('window');
const COL_GAP = 14;
const TILE_W = (width - 40 - COL_GAP) / 2;

const CategoriesScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { data: categories } = useCategories();

  // Only top-level categories appear here; sub-categories surface within them.
  const pets = categories.filter((c) => c.parentId == null);

  const openList = (params: { category?: string; title?: string }) =>
    navigation.navigate('ProductList', params);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View style={styles.headerDecor} />
        <Text style={styles.headerTitle}>Categories</Text>
        <Text style={styles.headerSub}>Everything your pet needs, beautifully sorted</Text>

        <PressableScale haptic={false} style={styles.search} onPress={() => openList({ title: 'All Products' })}>
          <Ionicons name="search-outline" size={19} color={COLORS.gray} />
          <Text style={styles.searchText}>Search medicines, food, grooming…</Text>
        </PressableScale>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Shop by Pet ── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Shop by Pet</Text>
          <Text style={styles.sectionCount}>{pets.length}</Text>
        </View>
        <View style={styles.grid}>
          {pets.map((c) => (
            <PressableScale key={c.id} style={[styles.petTile, { backgroundColor: c.color }]} onPress={() => openList({ category: c.label })}>
              <View style={[styles.petBubble, { backgroundColor: c.iconBg }]}>
                <MediaThumb uri={c.imageUrl} emoji={c.icon} emojiSize={26} style={StyleSheet.absoluteFill} rounded={24} />
              </View>
              <View style={styles.petInfo}>
                <Text style={styles.petName} numberOfLines={1}>{c.label}</Text>
                <Text style={styles.petExplore}>Explore</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </PressableScale>
          ))}
        </View>

        {/* ── Shop by Need ── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Shop by Need</Text>
        </View>
        <View style={styles.grid}>
          {QUICK_LINKS.map((q) => (
            <PressableScale key={q.id} style={styles.needTile} onPress={() => openList({ title: q.label })}>
              <View style={[styles.needIcon, { backgroundColor: q.color + '1F' }]}>
                <Ionicons name={q.icon} size={24} color={q.color} />
              </View>
              <Text style={styles.needLabel} numberOfLines={1}>{q.label}</Text>
            </PressableScale>
          ))}
        </View>

        <PressableScale style={styles.allBtn} onPress={() => openList({ title: 'All Products' })}>
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.allBtnGrad}>
            <Text style={styles.allBtnText}>Browse all products</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </LinearGradient>
        </PressableScale>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden',
    borderBottomLeftRadius: RADII.xl, borderBottomRightRadius: RADII.xl,
  },
  headerDecor: {
    position: 'absolute', top: -70, right: -50, width: 180, height: 180,
    borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 6 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white,
    borderRadius: RADII.md, paddingHorizontal: 14, height: 48, marginTop: 18, ...SHADOWS.card,
  },
  searchText: { color: COLORS.gray, fontSize: 14 },

  scroll: { padding: 20, paddingBottom: 40 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  sectionCount: {
    fontSize: 12, fontWeight: '800', color: COLORS.primaryDark, backgroundColor: COLORS.primaryLight,
    minWidth: 22, textAlign: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADII.pill, overflow: 'hidden',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COL_GAP, marginBottom: 22 },

  petTile: {
    width: TILE_W, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADII.lg, padding: 12, ...SHADOWS.card,
  },
  petBubble: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  petInfo: { flex: 1 },
  petName: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  petExplore: { fontSize: 11, color: COLORS.gray, marginTop: 1, fontWeight: '600' },

  needTile: {
    width: TILE_W, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 14, ...SHADOWS.card,
  },
  needIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  needLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.black },

  allBtn: { borderRadius: RADII.lg, ...SHADOWS.floating },
  allBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: RADII.lg },
  allBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});

export default CategoriesScreen;

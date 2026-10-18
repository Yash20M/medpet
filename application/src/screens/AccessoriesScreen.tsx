import React, { useCallback, useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../components/Icon';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAccessories } from '../hooks/useCatalog';
import { useCart } from '../context/CartContext';
import { usePets } from '../context/PetsContext';
import AccessoryCard from '../components/AccessoryCard';
import PetTypeChips, { PetFilter } from '../components/PetTypeChips';
import EmptyState from '../components/EmptyState';
import { accessoriesFor, petTypesWithAccessories } from '../utils/accessories';
import { PET_TYPE_PLURAL } from '../types/pet.types';
import { COLORS, GRADIENTS, RADII } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Accessories'>;
  route: RouteProp<RootStackParamList, 'Accessories'>;
};

const GUTTER = 20;
const GAP = 12;

/** "See all" for Accessories: every accessory, filterable by pet type and searchable. */
const AccessoriesScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { itemCount } = useCart();
  const { primaryPet } = usePets();
  const { data, loading, error, reload } = useAccessories();

  const [filter, setFilter] = useState<PetFilter>((route.params?.petType as PetFilter | undefined) ?? 'all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const types = useMemo(() => petTypesWithAccessories(data), [data]);
  // A pet type with no tagged accessories (e.g. opened for a hamster) degrades to "All".
  const active: PetFilter = filter === 'all' || types.includes(filter) ? filter : 'all';

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byPet = accessoriesFor(data, active);
    return q ? byPet.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) : byPet;
  }, [data, active, query]);

  const cols = width >= 700 ? 3 : 2;
  const cardW = Math.floor((width - GUTTER * 2 - GAP * (cols - 1)) / cols);

  const onRefresh = useCallback(async () => { setRefreshing(true); await reload(); setRefreshing(false); }, [reload]);

  const heading = active === 'all' ? 'All accessories' : `For ${PET_TYPE_PLURAL[active].toLowerCase()}`;

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Accessories</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Main', { screen: 'Cart' })} accessibilityLabel="Cart">
            <Ionicons name="cart-outline" size={24} color={COLORS.white} />
            {itemCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{itemCount}</Text></View>}
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search accessories..."
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
      ) : error && data.length === 0 ? (
        <EmptyState
          emoji="📡"
          title="Couldn't load accessories"
          subtitle="Check your connection and try again."
          ctaLabel="Retry"
          onCta={reload}
        />
      ) : data.length === 0 ? (
        <EmptyState emoji="🎀" title="No accessories yet" subtitle="Collars, toys, beds and more are coming soon." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        >
          <View style={styles.chips}>
            <PetTypeChips types={types} value={active} onChange={setFilter} yourPet={primaryPet?.type ?? null} gutter={GUTTER} />
          </View>

          <View style={styles.body}>
            <Text style={styles.count}>{heading} · {list.length} item{list.length === 1 ? '' : 's'}</Text>
            {list.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Nothing found</Text>
                <Text style={styles.emptySub}>{query ? 'Try a different search.' : 'No accessories for this pet yet.'}</Text>
              </View>
            ) : (
              // key replays the entrance animation when the filter changes
              <View key={`${active}:${query}`} style={styles.grid}>
                {list.map((p, i) => (
                  <AccessoryCard
                    key={p.id}
                    product={p}
                    width={cardW}
                    index={i % 8}
                    onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                  />
                ))}
              </View>
            )}
          </View>
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
  badge: {
    position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.primaryDark,
  },
  badgeText: { color: COLORS.black, fontSize: 10, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white,
    borderRadius: RADII.md, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingTop: 14 },
  body: { paddingHorizontal: GUTTER, paddingTop: 12 },
  count: { fontSize: 12, fontWeight: '700', color: COLORS.gray, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 46, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
});

export default AccessoriesScreen;

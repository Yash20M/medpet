import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Text, TextInput } from './AppText';
import Ionicons from './Icon';
import PressableScale from './PressableScale';
import { Product } from '../types/product.types';
import {
  Filters, EMPTY_FILTERS, activeFilterCount, applyFilters, PetTypesOf,
  brandOptions, priceOptions, petTypeOptions, DISCOUNT_OPTIONS, RATING_OPTIONS,
} from '../utils/productFilters';
import { PET_TYPE_ORDER, PET_TYPE_PLURAL, PetType } from '../types/pet.types';
import { COLORS, RADII } from '../theme/colors';

interface Props {
  visible: boolean;
  /** Products in the current category/search — before any filter — used for the option counts. */
  base: Product[];
  petTypesOf: PetTypesOf;
  value: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}

type SectionKey = 'brand' | 'pet' | 'price' | 'discount' | 'rating' | 'stock';

const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Full-screen "Filters": section list on the left, options with counts on the right, Apply at the bottom. */
const FilterSheet = ({ visible, base, petTypesOf, value, onApply, onClose }: Props) => {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Filters>(value);
  const [section, setSection] = useState<SectionKey>('brand');
  const [brandQuery, setBrandQuery] = useState('');

  // Start from the applied filters each time the sheet opens.
  useEffect(() => {
    if (visible) { setDraft(value); setBrandQuery(''); }
  }, [visible, value]);

  const brands = useMemo(() => brandOptions(base, draft.brands), [base, draft.brands]);
  const prices = useMemo(() => priceOptions(base, draft.prices), [base, draft.prices]);
  const pets = useMemo(
    () => petTypeOptions(base, petTypesOf, PET_TYPE_ORDER, (t) => PET_TYPE_PLURAL[t as PetType] ?? t, draft.petTypes),
    [base, petTypesOf, draft.petTypes]
  );
  const matches = useMemo(() => applyFilters(base, draft, petTypesOf).length, [base, draft, petTypesOf]);

  const sections: { key: SectionKey; label: string; selected: number }[] = [
    ...(brands.length ? [{ key: 'brand' as const, label: 'Brand', selected: draft.brands.length }] : []),
    ...(pets.length ? [{ key: 'pet' as const, label: 'Pet Type', selected: draft.petTypes.length }] : []),
    ...(prices.length ? [{ key: 'price' as const, label: 'Price', selected: draft.prices.length }] : []),
    { key: 'discount', label: 'Discount', selected: draft.minDiscount > 0 ? 1 : 0 },
    { key: 'rating', label: 'Rating', selected: draft.minRating > 0 ? 1 : 0 },
    { key: 'stock', label: 'Availability', selected: draft.inStockOnly ? 1 : 0 },
  ];
  // If the open section vanished (e.g. no brands in this category) fall back to the first one.
  const current: SectionKey = sections.some((s) => s.key === section) ? section : sections[0].key;

  const visibleBrands = brandQuery.trim()
    ? brands.filter((b) => b.label.toLowerCase().includes(brandQuery.trim().toLowerCase()))
    : brands;

  const tick = () => Haptics.selectionAsync().catch(() => {});
  const changed = activeFilterCount(draft) > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close filters">
            <Ionicons name="close" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          {changed && (
            <TouchableOpacity onPress={() => { setDraft(EMPTY_FILTERS); tick(); }} hitSlop={10} accessibilityLabel="Clear all filters">
              <Text style={styles.clear}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          {/* Left: sections */}
          <ScrollView style={styles.left} showsVerticalScrollIndicator={false}>
            {sections.map((s) => {
              const on = s.key === current;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.tab, on && styles.tabOn]}
                  onPress={() => setSection(s.key)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{s.label}</Text>
                  {s.selected > 0 && <View style={styles.dot}><Text style={styles.dotText}>{s.selected}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Right: options */}
          <ScrollView style={styles.right} contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {current === 'brand' && (
              <>
                {brands.length > 8 && (
                  <View style={styles.search}>
                    <Ionicons name="search-outline" size={16} color={COLORS.gray} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search brands"
                      placeholderTextColor={COLORS.gray}
                      value={brandQuery}
                      onChangeText={setBrandQuery}
                    />
                  </View>
                )}
                {visibleBrands.map((b) => (
                  <CheckRow
                    key={b.value}
                    label={b.label}
                    count={b.count}
                    on={draft.brands.some((x) => x.toLowerCase() === b.value.toLowerCase())}
                    onPress={() => { tick(); setDraft((d) => ({ ...d, brands: toggle(d.brands, b.value) })); }}
                  />
                ))}
                {visibleBrands.length === 0 && <Text style={styles.none}>No brands match.</Text>}
              </>
            )}

            {current === 'pet' && pets.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                count={o.count}
                on={draft.petTypes.includes(o.value)}
                onPress={() => { tick(); setDraft((d) => ({ ...d, petTypes: toggle(d.petTypes, o.value) })); }}
              />
            ))}

            {current === 'price' && prices.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                count={o.count}
                on={draft.prices.includes(o.value)}
                onPress={() => { tick(); setDraft((d) => ({ ...d, prices: toggle(d.prices, o.value) })); }}
              />
            ))}

            {current === 'discount' && DISCOUNT_OPTIONS.map((n) => (
              <CheckRow
                key={n}
                radio
                label={`${n}% & above`}
                on={draft.minDiscount === n}
                onPress={() => { tick(); setDraft((d) => ({ ...d, minDiscount: d.minDiscount === n ? 0 : n })); }}
              />
            ))}

            {current === 'rating' && RATING_OPTIONS.map((n) => (
              <CheckRow
                key={n}
                radio
                label={`${n}★ & above`}
                on={draft.minRating === n}
                onPress={() => { tick(); setDraft((d) => ({ ...d, minRating: d.minRating === n ? 0 : n })); }}
              />
            ))}

            {current === 'stock' && (
              <CheckRow
                label="In stock only"
                on={draft.inStockOnly}
                onPress={() => { tick(); setDraft((d) => ({ ...d, inStockOnly: !d.inStockOnly })); }}
              />
            )}
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.matchText}>
            {matches === 0 ? 'No products match' : `${matches} product${matches === 1 ? '' : 's'} match`}
          </Text>
          <PressableScale
            onPress={() => { onApply(draft); onClose(); }}
            style={styles.apply}
            scaleTo={0.97}
            accessibilityLabel="Apply filters"
          >
            <Text style={styles.applyText}>Apply Filters</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
};

const CheckRow = ({ label, count, on, onPress, radio }: {
  label: string; count?: number; on: boolean; onPress: () => void; radio?: boolean;
}) => (
  <TouchableOpacity
    style={styles.optRow}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole={radio ? 'radio' : 'checkbox'}
    accessibilityState={{ checked: on }}
  >
    <View style={[radio ? styles.radio : styles.box, on && styles.boxOn]}>
      {on && (radio ? <View style={styles.radioDot} /> : <Ionicons name="checkmark" size={14} color={COLORS.white} />)}
    </View>
    <Text style={[styles.optLabel, on && styles.optLabelOn]} numberOfLines={1}>
      {label}
      {count != null && <Text style={styles.optCount}>{`  (${count})`}</Text>}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.black },
  clear: { fontSize: 13.5, fontWeight: '800', color: COLORS.primaryDark },

  body: { flex: 1, flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.grayBorder },
  left: { width: '34%', flexGrow: 0, backgroundColor: '#F4F6F2' },
  tab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    minHeight: 52, paddingHorizontal: 14,
  },
  tabOn: { backgroundColor: COLORS.white },
  tabText: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: COLORS.gray },
  tabTextOn: { fontWeight: '800', color: COLORS.black },
  dot: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  dotText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },

  right: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: RADII.sm,
    backgroundColor: COLORS.grayLight, paddingHorizontal: 12, marginVertical: 6,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: COLORS.black, padding: 0 },
  none: { fontSize: 13, color: COLORS.gray, paddingVertical: 20, textAlign: 'center' },

  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
  box: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: '#9CA3AF',
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#9CA3AF',
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.white },
  optLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: COLORS.ink },
  optLabelOn: { fontWeight: '800', color: COLORS.black },
  optCount: { fontSize: 12.5, fontWeight: '500', color: COLORS.gray },

  footer: {
    paddingHorizontal: 16, paddingTop: 10, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
  },
  matchText: { fontSize: 12, fontWeight: '700', color: COLORS.gray, textAlign: 'center', marginBottom: 8 },
  apply: { height: 54, borderRadius: RADII.md, backgroundColor: COLORS.black, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});

export default FilterSheet;

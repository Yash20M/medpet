import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import PressableScale from '../PressableScale';
import { Brand } from '../../data/premium';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  brands: Brand[];
  onBrand: (name: string) => void;
}

/** Horizontally scrollable brand chips. */
const BrandsRow = ({ brands, onBrand }: Props) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}>
    {brands.map((b) => (
      <PressableScale key={b.id} style={styles.card} onPress={() => onBrand(b.name)} scaleTo={0.93}>
        <View style={[styles.logo, { backgroundColor: b.tint }]}>
          <Text style={{ fontSize: 26 }}>{b.emoji}</Text>
        </View>
        <Text style={styles.name}>{b.name}</Text>
      </PressableScale>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  card: {
    width: 92, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: RADII.md, paddingVertical: 12, ...SHADOWS.card,
  },
  logo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  name: { fontSize: 11, fontWeight: '700', color: COLORS.black, textAlign: 'center' },
});

export default BrandsRow;

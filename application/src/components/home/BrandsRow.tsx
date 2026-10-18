import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../AppText';
import PressableScale from '../PressableScale';
import FadeInView from '../FadeInView';
import MediaThumb from '../MediaThumb';
import { Brand } from '../../data/premium';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  brands: Brand[];
  onBrand: (brand: Brand) => void;
}

/** Horizontally scrollable brand chips (logo when uploaded, emoji otherwise). */
const BrandsRow = ({ brands, onBrand }: Props) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}>
    {brands.map((b, i) => (
      <FadeInView key={b.id} delay={i * 60} distance={12}>
        <PressableScale style={styles.card} onPress={() => onBrand(b)} scaleTo={0.93} accessibilityLabel={`${b.name} products`}>
          <MediaThumb
            uri={b.imageUrl}
            emoji={b.emoji}
            emojiSize={26}
            rounded={24}
            style={[styles.logo, { backgroundColor: b.tint }]}
          />
          <Text style={styles.name} numberOfLines={2}>{b.name}</Text>
          {!!b.productCount && (
            <Text style={styles.count}>{b.productCount} item{b.productCount === 1 ? '' : 's'}</Text>
          )}
        </PressableScale>
      </FadeInView>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  card: {
    width: 96, minHeight: 112, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: RADII.md, paddingVertical: 12, paddingHorizontal: 6, ...SHADOWS.card,
  },
  logo: { width: 48, height: 48, borderRadius: 24, marginBottom: 8 },
  name: { fontSize: 11, fontWeight: '700', color: COLORS.black, textAlign: 'center', lineHeight: 14 },
  count: { fontSize: 10, color: COLORS.gray, marginTop: 2, fontWeight: '600' },
});

export default BrandsRow;

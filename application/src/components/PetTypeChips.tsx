import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from './AppText';
import PressableScale from './PressableScale';
import { PetType, PET_EMOJI, PET_TYPE_PLURAL } from '../types/pet.types';
import { COLORS, RADII } from '../theme/colors';

export type PetFilter = PetType | 'all';

interface Props {
  /** Pet types to offer after "All". */
  types: PetType[];
  value: PetFilter;
  onChange: (v: PetFilter) => void;
  /** Type of the signed-in user's pet — marked so it's easy to spot. */
  yourPet?: PetType | null;
  /** Side padding so the row lines up with the page gutter while scrolling edge-to-edge. */
  gutter?: number;
}

/** Horizontal pill row: All · 🐕 Dogs · 🐈 Cats … */
const PetTypeChips = ({ types, value, onChange, yourPet, gutter = 0 }: Props) => {
  const items: { key: PetFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...types.map((t) => ({ key: t as PetFilter, label: `${PET_EMOJI[t]} ${PET_TYPE_PLURAL[t]}` })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <PressableScale
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[styles.chip, active && styles.chipActive]}
            scaleTo={0.94}
            haptic={false}
            accessibilityLabel={`${it.label}${yourPet && it.key === yourPet ? ', your pet' : ''}`}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>{it.label}</Text>
            {yourPet && it.key === yourPet && (
              <Text style={[styles.mine, active && styles.mineActive]}>· yours</Text>
            )}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36,
    paddingHorizontal: 14, borderRadius: RADII.pill, backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  text: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  textActive: { color: COLORS.white },
  mine: { fontSize: 10, fontWeight: '800', color: COLORS.primaryDark },
  mineActive: { color: 'rgba(255,255,255,0.9)' },
});

export default PetTypeChips;

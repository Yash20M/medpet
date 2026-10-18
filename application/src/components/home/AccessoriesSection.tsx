import React, { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../AppText';
import SectionHeader from '../SectionHeader';
import PetTypeChips, { PetFilter } from '../PetTypeChips';
import AccessoryCard from '../AccessoryCard';
import { Product } from '../../types/product.types';
import { Pet } from '../../types/pet.types';
import { accessoriesFor, petTypesWithAccessories } from '../../utils/accessories';
import { COLORS } from '../../theme/colors';

/** Accessories shown on Home before "See all". */
export const ACCESSORIES_ON_HOME = 6;
const GUTTER = 20;
const GAP = 12;

interface Props {
  accessories: Product[];
  /** The signed-in user's main pet — picks the starting tab. */
  pet: Pet | null;
  onProduct: (id: string) => void;
  onSeeAll: (petType: PetFilter) => void;
}

/**
 * "Accessories" on Home: pet-type tabs (All · Dogs · Cats …), up to 6 matching
 * accessories, and "See all" into the full page. Starts on the user's pet type
 * when there are accessories for it; the user's own tab choice always wins after that.
 */
const AccessoriesSection = ({ accessories, pet, onProduct, onSeeAll }: Props) => {
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - GUTTER * 2 - GAP) / 2);

  const types = useMemo(() => petTypesWithAccessories(accessories), [accessories]);
  const petFilter: PetFilter | null = pet && types.includes(pet.type) ? pet.type : null;
  const [picked, setPicked] = useState<PetFilter | null>(null);
  // Fall back if the picked tab disappeared (e.g. after a refresh removed its accessories).
  const selected: PetFilter = picked && (picked === 'all' || types.includes(picked)) ? picked : petFilter ?? 'all';

  const list = useMemo(() => accessoriesFor(accessories, selected), [accessories, selected]);

  if (accessories.length === 0) return null;

  const subtitle = pet && selected === pet.type ? `Picked for ${pet.name}` : 'Collars, toys, beds & more';

  return (
    <View style={styles.section}>
      <SectionHeader title="Accessories" subtitle={subtitle} onAction={() => onSeeAll(selected)} />
      <View style={styles.chips}>
        <PetTypeChips types={types} value={selected} onChange={setPicked} yourPet={pet?.type ?? null} gutter={GUTTER} />
      </View>
      {list.length === 0 ? (
        <Text style={styles.empty}>No accessories for this pet yet.</Text>
      ) : (
        // key resets the entrance animation when the tab changes
        <View key={selected} style={styles.grid}>
          {list.slice(0, ACCESSORIES_ON_HOME).map((p, i) => (
            <AccessoryCard key={p.id} product={p} width={cardW} index={i} onPress={() => onProduct(p.id)} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { paddingHorizontal: GUTTER, marginBottom: 24 },
  chips: { marginHorizontal: -GUTTER, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { fontSize: 13, color: COLORS.gray, paddingVertical: 20, textAlign: 'center' },
});

export default AccessoriesSection;

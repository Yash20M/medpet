import { Product } from '../types/product.types';
import { PetType, PET_TYPE_ORDER, PET_TYPE_PLURAL } from '../types/pet.types';

/** An accessory suits a pet if it lists that type, or lists none (= every pet). */
export const suitsPet = (p: Product, type: string): boolean => {
  const types = p.petTypes ?? [];
  return types.length === 0 || types.includes(type);
};

/** Pet types that at least one accessory is specifically tagged for, in display order. */
export const petTypesWithAccessories = (list: Product[]): PetType[] =>
  PET_TYPE_ORDER.filter((t) => list.some((p) => (p.petTypes ?? []).includes(t)));

/** Accessories to show for a chip: 'all' = everything, otherwise the ones that suit that pet. */
export const accessoriesFor = (list: Product[], type: PetType | 'all'): Product[] =>
  type === 'all' ? list : list.filter((p) => suitsPet(p, type));

/** "All pets" · "Dogs" · "Dogs, Cats" · "Dogs +2" */
export const petsLabel = (types: string[] | undefined): string => {
  const t = (types ?? []).filter((x): x is PetType => x in PET_TYPE_PLURAL);
  if (t.length === 0) return 'All pets';
  const names = t.map((x) => PET_TYPE_PLURAL[x]);
  return names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1}`;
};

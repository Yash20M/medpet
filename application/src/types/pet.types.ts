export type PetType = 'dog' | 'cat' | 'bird' | 'fish' | 'rabbit' | 'horse' | 'reptile' | 'other';
export type PetGender = 'male' | 'female' | 'unknown';

export interface Pet {
  id: number;
  user_id: number;
  name: string;
  type: PetType;
  breed: string;
  gender: PetGender;
  age_years: number | null;
  weight_kg: number | null;
  birth_date?: string | null;
  avatar_url: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PetDraft {
  name: string;
  type: PetType;
  breed?: string;
  gender?: PetGender;
  age_years?: number | null;
  weight_kg?: number | null;
  birth_date?: string | null;
  avatar_url?: string | null;
  notes?: string;
}

export const PET_EMOJI: Record<PetType, string> = {
  dog: '🐕', cat: '🐈', bird: '🐦', fish: '🐟',
  rabbit: '🐇', horse: '🐎', reptile: '🦎', other: '🐾',
};

export const PET_TYPE_LABEL: Record<PetType, string> = {
  dog: 'Dog', cat: 'Cat', bird: 'Bird', fish: 'Fish',
  rabbit: 'Rabbit', horse: 'Horse', reptile: 'Reptile', other: 'Other',
};

/** Plural labels for headings / chips ("Dogs"). */
export const PET_TYPE_PLURAL: Record<PetType, string> = {
  dog: 'Dogs', cat: 'Cats', bird: 'Birds', fish: 'Fish',
  rabbit: 'Rabbits', horse: 'Horses', reptile: 'Reptiles', other: 'Other pets',
};

/** Display order for pet-type chips. */
export const PET_TYPE_ORDER: PetType[] = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'horse', 'reptile', 'other'];

export const formatPetAge = (years: number | null): string => {
  if (years == null) return 'Age not set';
  if (years < 1) return `${Math.round(years * 12)} mo`;
  return years % 1 === 0 ? `${years} yr` : `${years} yrs`;
};

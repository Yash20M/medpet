export type PetType = 'dog' | 'cat' | 'bird' | 'fish' | 'rabbit' | 'horse' | 'reptile' | 'other';
export type PetGender = 'male' | 'female' | 'unknown';

export interface PetRow {
  id: number;
  user_id: number;
  name: string;
  type: PetType;
  breed: string;
  gender: PetGender;
  age_years: number | null;
  weight_kg: number | null;
  /** Approximate or exact birthday; DATE column (pg hands back a Date). */
  birth_date: Date | null;
  avatar_url: string | null;
  notes: string;
  created_at: Date;
  updated_at: Date;
}

export interface Pet extends Omit<PetRow, 'age_years' | 'weight_kg' | 'birth_date'> {
  age_years: number | null;
  weight_kg: number | null;
  /** YYYY-MM-DD */
  birth_date: string | null;
}

export interface CreatePetDto {
  name: string;
  type: PetType;
  breed?: string;
  gender?: PetGender;
  age_years?: number | null;
  weight_kg?: number | null;
  /** YYYY-MM-DD */
  birth_date?: string | null;
  avatar_url?: string | null;
  notes?: string;
}

export type UpdatePetDto = Partial<CreatePetDto>;

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
  avatar_url: string | null;
  notes: string;
  created_at: Date;
  updated_at: Date;
}

export interface Pet extends Omit<PetRow, 'age_years' | 'weight_kg'> {
  age_years: number | null;
  weight_kg: number | null;
}

export interface CreatePetDto {
  name: string;
  type: PetType;
  breed?: string;
  gender?: PetGender;
  age_years?: number | null;
  weight_kg?: number | null;
  avatar_url?: string | null;
  notes?: string;
}

export type UpdatePetDto = Partial<CreatePetDto>;

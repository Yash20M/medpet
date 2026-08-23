import { Product } from '../products/products.types';

export interface TipSection {
  heading: string;
  body: string;
}

export interface HealthTip {
  id: number;
  title: string;
  teaser: string;
  icon: string;
  color_from: string;
  color_to: string;
  read_mins: number;
  sections: TipSection[];
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface Brand {
  id: number;
  name: string;
  emoji: string;
  tint: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface Testimonial {
  id: number;
  owner_name: string;
  pet_name: string;
  pet_emoji: string;
  rating: number;
  body: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface Store {
  id: number;
  name: string;
  area: string;
  distance_km: string;   // NUMERIC comes back as string from pg
  eta_mins: number;
  is_open: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface CreateTipDto {
  title: string;
  teaser?: string;
  icon?: string;
  color_from?: string;
  color_to?: string;
  read_mins?: number;
  sections?: TipSection[];
  sort_order?: number;
}
export type UpdateTipDto = Partial<CreateTipDto> & { is_active?: boolean };

export interface CreateBrandDto {
  name: string;
  emoji?: string;
  tint?: string;
  sort_order?: number;
}
export type UpdateBrandDto = Partial<CreateBrandDto> & { is_active?: boolean };

export interface CreateTestimonialDto {
  owner_name: string;
  pet_name?: string;
  pet_emoji?: string;
  rating?: number;
  body: string;
  sort_order?: number;
}
export type UpdateTestimonialDto = Partial<CreateTestimonialDto> & { is_active?: boolean };

export interface CreateStoreDto {
  name: string;
  area?: string;
  distance_km?: number;
  eta_mins?: number;
  is_open?: boolean;
  sort_order?: number;
}
export type UpdateStoreDto = Partial<CreateStoreDto> & { is_active?: boolean };

/** Everything the mobile Home screen needs, in one request. */
export interface HomeContent {
  tips: HealthTip[];
  brands: Brand[];
  testimonials: Testimonial[];
  stores: Store[];
  flash_products: Product[];
  settings: Record<string, string>;
}

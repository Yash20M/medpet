export interface Offer {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  code: string | null;
  emoji: string;
  color_from: string;
  color_to: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface CreateOfferDto {
  title: string;
  subtitle?: string;
  badge?: string;
  code?: string;
  emoji?: string;
  color_from?: string;
  color_to?: string;
  sort_order?: number;
}

export type UpdateOfferDto = Partial<CreateOfferDto> & { is_active?: boolean };

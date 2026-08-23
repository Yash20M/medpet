export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  image_url: string | null;
  parent_id: number | null;
  parent_name?: string | null;
  color: string;
  icon_bg: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  icon?: string;
  image_url?: string;
  parent_id?: number | null;
  color?: string;
  icon_bg?: string;
  sort_order?: number;
}

export interface UpdateCategoryDto extends Partial<CreateCategoryDto> {
  is_active?: boolean;
}

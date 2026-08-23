export interface ProductRow {
  id: number;
  name: string;
  brand: string;
  description: string;
  emoji: string;
  image_url: string | null;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  original_price: number;
  discount_price: number;
  rating: string;            // NUMERIC comes back as string from pg
  reviews_count: number;
  stock_quantity: number;
  low_stock_threshold: number;
  in_stock: boolean;
  is_featured: boolean;
  is_flash_sale: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface Product extends Omit<ProductRow, 'rating' | 'is_active'> {
  rating: number;
  discount_percent: number;
}

export interface ProductQuery {
  category?: string;   // category slug
  featured?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateProductDto {
  name: string;
  brand?: string;
  description?: string;
  emoji?: string;
  image_url?: string;
  category_id?: number;
  original_price: number;
  discount_price: number;
  rating?: number;
  reviews_count?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  in_stock?: boolean;
  is_featured?: boolean;
  is_flash_sale?: boolean;
}

export type UpdateProductDto = Partial<CreateProductDto> & { is_active?: boolean };

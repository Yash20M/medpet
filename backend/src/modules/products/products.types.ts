export interface ProductRow {
  id: number;
  name: string;
  brand: string;
  brand_id: number | null;
  description: string;
  emoji: string;
  image_url: string | null;
  /** Gallery, first = image_url. Max 5. */
  image_urls: string[];
  /** Free text: SKU, country of origin, manufacturer name & address… */
  manufacturer_details: string;
  /** "Additional details" → Ingredients. */
  ingredients: string;
  /** "Additional details" → Uses / directions. */
  uses: string;
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
  is_accessory: boolean;
  /** Pet types this accessory suits; empty = every pet. */
  pet_types: string[];
  is_active: boolean;
  created_at: Date;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  /** Size / weight shown to the customer, e.g. "10kg", "500g". */
  label: string;
  original_price: number;
  discount_price: number;
  stock_quantity: number;
  sort_order: number;
  discount_percent: number;
}

export interface Product extends Omit<ProductRow, 'rating' | 'is_active'> {
  rating: number;
  discount_percent: number;
  /** Present on product list/detail responses; empty = a single-size product. */
  variants?: ProductVariant[];
}

/** Admin-supplied variant. With an `id` it updates that variant, without one it is created. */
export interface VariantInput {
  id?: number;
  label: string;
  original_price: number;
  discount_price: number;
  stock_quantity: number;
}

export interface ProductQuery {
  category?: string;   // category slug
  featured?: boolean;
  search?: string;
  /** true → only accessories, false → only non-accessories, undefined → both. */
  accessory?: boolean;
  /** Pet type (dog, cat…): accessories that suit it, plus ones suiting every pet. */
  petType?: string;
  brandId?: number;
  /** Exact (case-insensitive) brand name — for app builds that only know the name. */
  brand?: string;
  page?: number;
  limit?: number;
}

export interface CreateProductDto {
  name: string;
  /** Preferred: id of a managed brand. `null` clears the brand. */
  brand_id?: number | null;
  /** Legacy: a brand name — matched to (or creates) a managed brand. */
  brand?: string;
  description?: string;
  emoji?: string;
  image_url?: string;
  /** Full gallery (max 5); the first becomes `image_url`. `[]` clears all images. */
  image_urls?: string[];
  manufacturer_details?: string;
  ingredients?: string;
  uses?: string;
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
  is_accessory?: boolean;
  pet_types?: string[];
  /** Full replacement list of size variants; `[]` removes them all. Omit to leave untouched. */
  variants?: VariantInput[];
}

export type UpdateProductDto = Partial<CreateProductDto> & { is_active?: boolean };

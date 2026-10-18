import { useState, useEffect, useCallback } from 'react';
import {
  productAPI, categoryAPI, offerAPI,
  ApiProduct, ApiCategory, ApiOffer,
} from '../services/api';
import { Product, Category } from '../types/product.types';
import { PRODUCTS as MOCK_PRODUCTS, CATEGORIES as MOCK_CATEGORIES } from '../data/products';
import type { BannerData } from '../components/BannerCarousel';

const fmtReviews = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export const mapProduct = (p: ApiProduct): Product => ({
  id: String(p.id),
  name: p.name,
  brand: p.brand,
  emoji: p.emoji,
  imageUrl: p.image_url,
  imageUrls: p.image_urls ?? [],
  manufacturerDetails: p.manufacturer_details ?? '',
  ingredients: p.ingredients ?? '',
  uses: p.uses ?? '',
  description: p.description,
  price: p.discount_price,
  originalPrice: p.original_price,
  rating: Number(p.rating).toFixed(1),
  reviews: fmtReviews(p.reviews_count),
  category: p.category_name ?? '',
  inStock: p.in_stock,
  stockQuantity: p.stock_quantity,
  isFeatured: p.is_featured,
  reviewsCount: p.reviews_count,
  createdAt: p.created_at,
  isAccessory: p.is_accessory ?? false,
  petTypes: p.pet_types ?? [],
  variants: (p.variants ?? []).map((v) => ({
    id: String(v.id), label: v.label, price: v.discount_price,
    originalPrice: v.original_price, stockQuantity: v.stock_quantity,
  })),
});

export const mapCategory = (c: ApiCategory): Category => ({
  id: String(c.id),
  icon: c.icon,
  imageUrl: c.image_url,
  label: c.name,
  color: c.color,
  iconBg: c.icon_bg,
  parentId: c.parent_id ?? null,
});

export const mapOfferToBanner = (o: ApiOffer): BannerData => ({
  id: String(o.id),
  title: o.title,
  subtitle: o.subtitle,
  emoji: o.emoji,
  badge: o.badge,
  colors: [o.color_from, o.color_to],
  accent: 'rgba(255,255,255,0.3)',
});

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

const PAGE_SIZE = 100; // server maximum
const MAX_PAGES = 10;  // safety stop (1,000 products)

/** Loads every page of a product query (the API caps one page at 100). */
async function fetchAllProducts(filter?: Parameters<typeof productAPI.list>[0]): Promise<ApiProduct[]> {
  const first = await productAPI.list({ ...filter, limit: PAGE_SIZE, page: 1 });
  const out = [...first.data];
  const totalPages = (first as unknown as { pagination?: { totalPages?: number } }).pagination?.totalPages ?? 1;
  for (let page = 2; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const next = await productAPI.list({ ...filter, limit: PAGE_SIZE, page });
    out.push(...next.data);
  }
  return out;
}

/** Featured falls back to the first few mock products; a brand filter falls back to a name match. */
export function useProducts(params?: { featured?: boolean; brandId?: number; brand?: string }): AsyncState<Product[]> {
  const featured = params?.featured;
  const brandId = params?.brandId;
  const brand = params?.brand;
  const fallback = featured
    ? MOCK_PRODUCTS.slice(0, 4)
    : brand
      ? MOCK_PRODUCTS.filter((p) => p.brand.toLowerCase() === brand.toLowerCase())
      : brandId
        ? []
        : MOCK_PRODUCTS;
  const [data, setData] = useState<Product[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const filter = {
        ...(featured ? { featured: true } : {}),
        ...(brandId ? { brand_id: brandId } : brand ? { brand } : {}),
      };
      const rows = await fetchAllProducts(Object.keys(filter).length ? filter : undefined);
      setData(rows.map(mapProduct));
    } catch {
      setData(fallback);
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured, brandId, brand]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

/** Every active accessory (they are few; the app filters by pet type locally for instant tab switches). */
export function useAccessories(): AsyncState<Product[]> {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setError(false);
    try {
      const res = await productAPI.list({ accessory: true, limit: 100 });
      setData(res.data.map(mapProduct));
    } catch {
      setError(true); // keep whatever we had — no mock accessories
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useCategories(): AsyncState<Category[]> {
  const [data, setData] = useState<Category[]>(MOCK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await categoryAPI.list();
      setData(res.data.map(mapCategory));
    } catch {
      setData(MOCK_CATEGORIES);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useOffers(): AsyncState<BannerData[]> {
  const [data, setData] = useState<BannerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await offerAPI.list();
      setData(res.data.map(mapOfferToBanner));
    } catch {
      setData([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

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
  description: p.description,
  price: p.discount_price,
  originalPrice: p.original_price,
  rating: Number(p.rating).toFixed(1),
  reviews: fmtReviews(p.reviews_count),
  category: p.category_name ?? '',
  inStock: p.in_stock,
  stockQuantity: p.stock_quantity,
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

/** Featured falls back to the first few mock products. */
export function useProducts(params?: { featured?: boolean }): AsyncState<Product[]> {
  const featured = params?.featured;
  const fallback = featured ? MOCK_PRODUCTS.slice(0, 4) : MOCK_PRODUCTS;
  const [data, setData] = useState<Product[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await productAPI.list(featured ? { featured: true } : undefined);
      setData(res.data.map(mapProduct));
    } catch {
      setData(fallback);
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured]);

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

import type { Product, Category } from '../types/product.types';

// ─── Sorting ────────────────────────────────────────────────────────────────

export type SortKey =
  | 'popularity' | 'price_asc' | 'price_desc'
  | 'name_asc' | 'name_desc' | 'newest' | 'discount';

export const DEFAULT_SORT: SortKey = 'popularity';

/** `label` is the full name (sort sheet); `short` fits the toolbar button even at large font sizes. */
export const SORT_OPTIONS: { key: SortKey; label: string; short: string }[] = [
  { key: 'popularity', label: 'Popularity', short: 'Popular' },
  { key: 'price_asc', label: 'Price: Low to High', short: 'Price ↑' },
  { key: 'price_desc', label: 'Price: High to Low', short: 'Price ↓' },
  { key: 'name_asc', label: 'Name: A to Z', short: 'A to Z' },
  { key: 'name_desc', label: 'Name: Z to A', short: 'Z to A' },
  { key: 'newest', label: "What's New", short: 'Newest' },
  { key: 'discount', label: 'Discount: High to Low', short: 'Discount' },
];

export const sortLabel = (k: SortKey): string => SORT_OPTIONS.find((o) => o.key === k)?.label ?? 'Sort';
export const sortShortLabel = (k: SortKey): string => SORT_OPTIONS.find((o) => o.key === k)?.short ?? 'Sort';

export const discountPct = (p: Pick<Product, 'price' | 'originalPrice'>): number =>
  p.originalPrice > p.price && p.originalPrice > 0
    ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
    : 0;

const ratingOf = (p: Product): number => Number.parseFloat(p.rating) || 0;
const timeOf = (p: Product): number => (p.createdAt ? Date.parse(p.createdAt) || 0 : 0);
const byName = (a: Product, b: Product): number =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });
const idNum = (p: Product): number => Number(p.id) || 0;

/** Returns a NEW sorted array (never mutates). Every order falls back to name, then id, so it is stable. */
export const sortProducts = (list: Product[], key: SortKey): Product[] => {
  const cmp: Record<SortKey, (a: Product, b: Product) => number> = {
    // Most-reviewed first, then best-rated.
    popularity: (a, b) => (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0) || ratingOf(b) - ratingOf(a),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    name_asc: (a, b) => byName(a, b),
    name_desc: (a, b) => byName(b, a),
    newest: (a, b) => timeOf(b) - timeOf(a),
    discount: (a, b) => discountPct(b) - discountPct(a),
  };
  return [...list].sort((a, b) => cmp[key](a, b) || byName(a, b) || idNum(a) - idNum(b));
};

// ─── Filtering ──────────────────────────────────────────────────────────────

export interface PriceBucket { id: string; label: string; min: number; max: number }

export const PRICE_BUCKETS: PriceBucket[] = [
  { id: 'p0', label: 'Under ₹200', min: 0, max: 200 },
  { id: 'p1', label: '₹200 – ₹500', min: 200, max: 500 },
  { id: 'p2', label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { id: 'p3', label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { id: 'p4', label: '₹2,000 & above', min: 2000, max: Infinity },
];

export const DISCOUNT_OPTIONS = [10, 20, 30, 40] as const;
export const RATING_OPTIONS = [4, 3] as const;

export interface Filters {
  /** Brand names (case-insensitive match). */
  brands: string[];
  /** Pet types, e.g. 'dog'. */
  petTypes: string[];
  /** PRICE_BUCKETS ids — a product matches if it is in ANY selected bucket. */
  prices: string[];
  /** 0 = any; otherwise the product's discount must be at least this many %. */
  minDiscount: number;
  /** 0 = any; otherwise the rating must be at least this. */
  minRating: number;
  inStockOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  brands: [], petTypes: [], prices: [], minDiscount: 0, minRating: 0, inStockOnly: false,
};

export const activeFilterCount = (f: Filters): number =>
  f.brands.length + f.petTypes.length + f.prices.length +
  (f.minDiscount > 0 ? 1 : 0) + (f.minRating > 0 ? 1 : 0) + (f.inStockOnly ? 1 : 0);

const norm = (s: string): string => s.trim().toLowerCase();

/** Pet types a product is "for" ('all' = suits every pet). */
export type PetTypesOf = (p: Product) => string[] | 'all';

const inPrice = (p: Product, ids: string[]): boolean =>
  PRICE_BUCKETS.some((b) => ids.includes(b.id) && p.price >= b.min && p.price < b.max);

/**
 * AND across groups, OR within a group (picking Dogs + Cats shows both).
 * `petTypesOf` lets the screen resolve a product's pet through the category tree.
 */
export const applyFilters = (list: Product[], f: Filters, petTypesOf: PetTypesOf): Product[] => {
  const brands = f.brands.map(norm);
  return list.filter((p) => {
    if (brands.length && !brands.includes(norm(p.brand))) return false;
    if (f.petTypes.length) {
      const t = petTypesOf(p);
      if (t !== 'all' && !t.some((x) => f.petTypes.includes(x))) return false;
    }
    if (f.prices.length && !inPrice(p, f.prices)) return false;
    if (f.minDiscount > 0 && discountPct(p) < f.minDiscount) return false;
    if (f.minRating > 0 && ratingOf(p) < f.minRating) return false;
    if (f.inStockOnly && !p.inStock) return false;
    return true;
  });
};

// ─── Option lists with counts (computed on the unfiltered base set) ─────────

export interface CountedOption { value: string; label: string; count: number }

export const brandOptions = (base: Product[], selected: string[]): CountedOption[] => {
  const map = new Map<string, { label: string; count: number }>();
  for (const p of base) {
    const name = p.brand.trim();
    if (!name) continue;
    const k = norm(name);
    const cur = map.get(k);
    if (cur) cur.count += 1; else map.set(k, { label: name, count: 1 });
  }
  // keep a selected brand visible even if the base set no longer has it
  for (const s of selected) if (!map.has(norm(s))) map.set(norm(s), { label: s, count: 0 });
  // like the reference: most products first, then A–Z
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
    .map((v) => ({ value: v.label, label: v.label, count: v.count }));
};

export const priceOptions = (base: Product[], selected: string[]): CountedOption[] =>
  PRICE_BUCKETS
    .map((b) => ({ value: b.id, label: b.label, count: base.filter((p) => p.price >= b.min && p.price < b.max).length }))
    .filter((o) => o.count > 0 || selected.includes(o.value));

/**
 * Pet-type options. The count includes "suits every pet" accessories (they do show up when you pick
 * that pet), but a pet is only OFFERED if at least one product is made specifically for it — otherwise
 * a filter like "Horses" would just return a generic water bottle.
 */
export const petTypeOptions = (
  base: Product[], petTypesOf: PetTypesOf, order: string[], labelOf: (t: string) => string, selected: string[],
): CountedOption[] =>
  order
    .map((t) => {
      let count = 0;
      let specific = 0;
      for (const p of base) {
        const x = petTypesOf(p);
        if (x === 'all') count += 1;
        else if (x.includes(t)) { count += 1; specific += 1; }
      }
      return { value: t, label: labelOf(t), count, specific };
    })
    .filter((o) => o.specific > 0 || selected.includes(o.value))
    .map(({ value, label, count }) => ({ value, label, count }));

// ─── Pet type of a product ──────────────────────────────────────────────────

const SINGULAR: Record<string, string> = {
  dog: 'dog', dogs: 'dog', cat: 'cat', cats: 'cat', bird: 'bird', birds: 'bird', fish: 'fish',
  rabbit: 'rabbit', rabbits: 'rabbit', horse: 'horse', horses: 'horse',
  reptile: 'reptile', reptiles: 'reptile',
};

/** Accessories use their pet tags; other products use the pet named by their (top-level) category. */
export const makePetTypesOf = (categories: Category[]): PetTypesOf => {
  const byId = new Map(categories.map((c) => [String(c.id), c]));
  const byLabel = new Map(categories.map((c) => [norm(c.label), c]));
  const rootPet = (label: string): string | null => {
    let c = byLabel.get(norm(label));
    for (let i = 0; c && i < 6; i++) {
      const pet = SINGULAR[norm(c.label)];
      if (pet) return pet;
      c = c.parentId != null ? byId.get(String(c.parentId)) : undefined;
    }
    return null;
  };
  return (p: Product) => {
    if (p.isAccessory) return (p.petTypes ?? []).length ? (p.petTypes as string[]) : 'all';
    const pet = rootPet(p.category);
    return pet ? [pet] : [];
  };
};

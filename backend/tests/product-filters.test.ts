/**
 * Pure unit tests for the app's product SORT + FILTER logic
 * (application/src/utils/productFilters.ts) — no DB or server needed.
 *
 * Run:  npx ts-node -T tests/product-filters.test.ts
 */
import {
  sortProducts, applyFilters, EMPTY_FILTERS, activeFilterCount, discountPct,
  brandOptions, priceOptions, petTypeOptions, makePetTypesOf, SORT_OPTIONS, Filters, SortKey,
} from '../../application/src/utils/productFilters';

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, extra = ''): void => {
  if (c) { passed++; console.log(`  ✓ ${n}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); }
};

const P = (id: number, name: string, over: Record<string, unknown> = {}): any => ({
  id: String(id), name, brand: 'Acme', emoji: '💊', imageUrl: null,
  price: 100, originalPrice: 100, rating: '4.0', reviews: '1', reviewsCount: 1,
  category: 'Dogs', description: '', inStock: true, createdAt: '2026-01-01T00:00:00Z',
  isAccessory: false, petTypes: [], ...over,
});

const data = [
  P(1, 'Banana Chews', { brand: 'Zed', price: 300, originalPrice: 400, rating: '4.8', reviewsCount: 50, createdAt: '2026-03-01T00:00:00Z', category: 'Dogs' }),
  P(2, 'apple Biscuits', { brand: 'Acme', price: 120, originalPrice: 120, rating: '3.2', reviewsCount: 500, createdAt: '2026-05-01T00:00:00Z', category: 'Cats' }),
  P(3, 'Carrot Treats', { brand: 'acme', price: 1500, originalPrice: 2000, rating: '4.5', reviewsCount: 500, createdAt: '2026-02-01T00:00:00Z', category: 'Rabbit', inStock: false }),
  P(4, 'Dog Collar', { brand: 'PawPal', price: 350, originalPrice: 500, isAccessory: true, petTypes: ['dog'], category: '', reviewsCount: 5, rating: '4.9', createdAt: '2026-04-01T00:00:00Z' }),
  P(5, 'Travel Bottle', { brand: 'PawPal', price: 2500, originalPrice: 2500, isAccessory: true, petTypes: [], category: '', reviewsCount: 5, rating: '4.1', createdAt: '2026-04-15T00:00:00Z' }),
  P(6, 'Item 10', { brand: '', price: 199, originalPrice: 250, category: 'Mystery' }),
  P(7, 'Item 2', { brand: '', price: 200, originalPrice: 200, category: 'Mystery' }),
];
const names = (l: any[]): string[] => l.map((p) => p.name);

const cats: any[] = [
  { id: '1', label: 'Dogs', parentId: null }, { id: '2', label: 'Cats', parentId: null },
  { id: '3', label: 'Rabbit', parentId: null }, { id: '4', label: 'Puppy Food', parentId: 1 },
  { id: '5', label: 'Mystery', parentId: null },
];
const petOf = makePetTypesOf(cats);

// ── Sorting ────────────────────────────────────────────────────────────────
console.log('\n1) Sorting');
const sorted = (k: SortKey): string[] => names(sortProducts(data, k));
ok('7 sort options, the first is Popularity', SORT_OPTIONS.length === 7 && SORT_OPTIONS[0].key === 'popularity');
ok('Price: Low to High (cheapest first, most expensive last)', sorted('price_asc')[0] === 'apple Biscuits' && sorted('price_asc').slice(-1)[0] === 'Travel Bottle', sorted('price_asc').join(' < '));
const pa = sortProducts(data, 'price_asc').map((p) => p.price);
ok('…strictly non-decreasing', pa.every((v, i) => i === 0 || pa[i - 1] <= v));
const pd = sortProducts(data, 'price_desc').map((p) => p.price);
ok('Price: High to Low is non-increasing', pd.every((v, i) => i === 0 || pd[i - 1] >= v) && pd[0] === 2500);
ok('Name A→Z is case-insensitive ("apple" before "Banana")', sorted('name_asc')[0] === 'apple Biscuits' && sorted('name_asc')[1] === 'Banana Chews', sorted('name_asc').join(', '));
ok('Name A→Z is natural ("Item 2" before "Item 10")', sorted('name_asc').indexOf('Item 2') < sorted('name_asc').indexOf('Item 10'));
ok('Name Z→A is the exact reverse', sorted('name_desc').join() === [...sorted('name_asc')].reverse().join());
ok('What\'s New: latest first', sortProducts(data, 'newest')[0].name === 'apple Biscuits' && sortProducts(data, 'newest').slice(-1)[0].createdAt === '2026-01-01T00:00:00Z');
ok('Discount: High to Low (Dog Collar 30% > Banana/Carrot 25%)', discountPct(data[3]) === 30 && sorted('discount').slice(0, 3).join() === ['Dog Collar', 'Banana Chews', 'Carrot Treats'].join(), sorted('discount').slice(0, 3).join(', '));
ok('…equal discounts fall back to name', sorted('discount').indexOf('Banana Chews') < sorted('discount').indexOf('Carrot Treats'));
ok('Popularity: most reviews first, ties by rating (Carrot 4.5 > apple 3.2)', sorted('popularity').slice(0, 3).join() === ['Carrot Treats', 'apple Biscuits', 'Banana Chews'].join(), sorted('popularity').slice(0, 3).join(', '));
const before = names(data).join();
sortProducts(data, 'price_desc');
ok('sorting never mutates the input', names(data).join() === before);
ok('missing review counts / dates do not break sorting', sortProducts([P(9, 'X', { reviewsCount: undefined, createdAt: undefined }), P(8, 'Y')], 'popularity').length === 2);
ok('equal keys fall back to name (stable)', names(sortProducts([P(1, 'B', { price: 5 }), P(2, 'A', { price: 5 })], 'price_asc')).join() === 'A,B');

// ── Filtering ──────────────────────────────────────────────────────────────
console.log('\n2) Filtering');
const f = (o: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...o });
const run = (o: Partial<Filters>): string[] => names(applyFilters(data, f(o), petOf));
ok('no filters → everything', run({}).length === data.length);
ok('brand match is case-insensitive ("Acme" = "acme")', run({ brands: ['ACME'] }).join() === ['apple Biscuits', 'Carrot Treats'].join());
ok('several brands = OR', run({ brands: ['Zed', 'PawPal'] }).length === 3);
ok('price bucket ₹200–₹500 includes ₹200, excludes ₹500', run({ prices: ['p1'] }).join() === ['Banana Chews', 'Dog Collar', 'Item 2'].join(), run({ prices: ['p1'] }).join(', '));
ok('several price buckets = OR', run({ prices: ['p0', 'p4'] }).join() === ['apple Biscuits', 'Travel Bottle', 'Item 10'].join());
ok('discount 20%+ keeps 20–30% items, drops the 20%-less ones', run({ minDiscount: 20 }).join() === ['Banana Chews', 'Carrot Treats', 'Dog Collar', 'Item 10'].join(), run({ minDiscount: 20 }).join(', '));
ok('discount 30%+ keeps only the 30% item', run({ minDiscount: 30 }).join() === 'Dog Collar', run({ minDiscount: 30 }).join(', '));
ok('discount 40%+ → none', run({ minDiscount: 40 }).length === 0);
ok('rating 4+ excludes 3.2', !run({ minRating: 4 }).includes('apple Biscuits') && run({ minRating: 4 }).includes('Carrot Treats'));
ok('in-stock only drops sold-out items', !run({ inStockOnly: true }).includes('Carrot Treats') && run({ inStockOnly: true }).length === data.length - 1);
ok('groups combine with AND', run({ brands: ['PawPal'], prices: ['p1'] }).join() === 'Dog Collar');
ok('no match → empty list', run({ brands: ['Nope'] }).length === 0);

console.log('\n3) Pet type');
ok('a product\'s pet comes from its category', run({ petTypes: ['cat'] }).join() === ['apple Biscuits', 'Travel Bottle'].join(), run({ petTypes: ['cat'] }).join(', '));
ok('sub-category resolves through its parent (Puppy Food → dog)', JSON.stringify(petOf(P(11, 'Kibble', { category: 'Puppy Food' }))) === '["dog"]');
ok('accessory tagged dog shows for dogs', run({ petTypes: ['dog'] }).includes('Dog Collar'));
ok('accessory with no pets suits every pet', run({ petTypes: ['bird'] }).join() === 'Travel Bottle');
ok('Dogs + Cats = OR', run({ petTypes: ['dog', 'cat'] }).length === 4, run({ petTypes: ['dog', 'cat'] }).join(', '));
ok('unknown-category products only appear with no pet filter', !run({ petTypes: ['dog'] }).includes('Item 2') && run({}).includes('Item 2'));

// ── Options with counts ────────────────────────────────────────────────────
console.log('\n4) Option lists');
const bo = brandOptions(data, []);
ok('brands merge case variants and count them', bo.find((b) => b.label.toLowerCase() === 'acme')?.count === 2, JSON.stringify(bo.map((b) => `${b.label}(${b.count})`)));
ok('brands sorted by count then A–Z', bo[0].count >= bo[1].count);
ok('blank brands are skipped', !bo.some((b) => b.label === ''));
ok('a selected brand stays listed even with 0 matches', brandOptions(data, ['Ghost']).some((b) => b.label === 'Ghost' && b.count === 0));
const po = priceOptions(data, []);
ok('price buckets with no products are hidden, counts add up', po.every((o) => o.count > 0) && po.reduce((a, o) => a + o.count, 0) === data.length, po.map((o) => `${o.label}:${o.count}`).join(' | '));
const peto = petTypeOptions(data, petOf, ['dog', 'cat', 'bird', 'rabbit'], (t) => t, []);
ok('only pets with a product made for them are offered', peto.map((o) => o.value).join() === 'dog,cat,rabbit', peto.map((o) => `${o.value}:${o.count}`).join(' '));
ok('…so "Birds" (only a universal bottle) is not offered', !peto.some((o) => o.value === 'bird'));
ok('universal accessories still count toward an offered pet', peto.find((o) => o.value === 'cat')?.count === 2 && peto.find((o) => o.value === 'dog')?.count === 3);
ok('a selected pet stays listed even if nothing is made for it', petTypeOptions(data, petOf, ['bird'], (t) => t, ['bird']).length === 1);

console.log('\n5) Active count');
ok('empty filters = 0', activeFilterCount(EMPTY_FILTERS) === 0);
ok('counts every selected option', activeFilterCount(f({ brands: ['a', 'b'], petTypes: ['dog'], prices: ['p1'], minDiscount: 10, minRating: 4, inStockOnly: true })) === 7);

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

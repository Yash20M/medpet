import { useState, useRef, FormEvent } from 'react';
import { ArrowLeft, UploadCloud, Loader2, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { Product, Category, Brand, PET_TYPE_OPTIONS } from '../types';

interface FormState {
  name: string; emoji: string;
  original_price: string; discount_price: string; rating: string;
  reviews_count: string; stock_quantity: string; low_stock_threshold: string;
  description: string; manufacturer_details: string; ingredients: string; uses: string; in_stock: boolean; is_featured: boolean; is_flash_sale: boolean; is_accessory: boolean;
}

const EMPTY: FormState = {
  name: '', emoji: '💊',
  original_price: '', discount_price: '', rating: '4.5',
  reviews_count: '0', stock_quantity: '100', low_stock_threshold: '10',
  description: '', manufacturer_details: '', ingredients: '', uses: '', in_stock: true, is_featured: false, is_flash_sale: false, is_accessory: false,
};

/** One editable size row; numbers stay strings while typing. */
interface VariantRow { id?: number; label: string; original_price: string; discount_price: string; stock_quantity: string }

const EMPTY_VARIANT: VariantRow = { label: '', original_price: '', discount_price: '', stock_quantity: '0' };

/** Variant with the lowest discount price — what lists show as the product's price. */
const cheapestOf = (rows: VariantRow[]): VariantRow | undefined =>
  [...rows].sort((a, b) => Number(a.discount_price) - Number(b.discount_price))[0];

const MAX_IMAGES = 5;

interface Props {
  product: Product | null;       // null → add, otherwise → edit
  cats: Category[];
  brands: Brand[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export default function ProductForm({ product, cats, brands, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const initialCat = product ? cats.find((c) => c.id === product.category_id) : undefined;

  const [form, setForm] = useState<FormState>(
    product
      ? {
          name: product.name, emoji: product.emoji,
          original_price: String(product.original_price), discount_price: String(product.discount_price),
          rating: String(product.rating), reviews_count: String(product.reviews_count),
          stock_quantity: String(product.stock_quantity), low_stock_threshold: String(product.low_stock_threshold),
          description: product.description, manufacturer_details: product.manufacturer_details ?? '',
          ingredients: product.ingredients ?? '', uses: product.uses ?? '', in_stock: product.in_stock, is_featured: product.is_featured,
          is_flash_sale: product.is_flash_sale, is_accessory: product.is_accessory,
        }
      : EMPTY
  );
  // Size variants (10kg / 20kg…). When present they own price + stock; the product-level fields become a summary.
  const [variants, setVariants] = useState<VariantRow[]>(
    (product?.variants ?? []).map((v) => ({
      id: v.id, label: v.label, original_price: String(v.original_price),
      discount_price: String(v.discount_price), stock_quantity: String(v.stock_quantity),
    }))
  );
  const hasVariants = variants.length > 0;
  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setVariants((cur) => cur.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  // Gallery: up to MAX_IMAGES; the first one is the main image shown on cards.
  const [images, setImages] = useState<string[]>(
    product?.image_urls?.length ? product.image_urls : product?.image_url ? [product.image_url] : []
  );
  const moveToFront = (i: number) => setImages((cur) => [cur[i], ...cur.filter((_, idx) => idx !== i)]);
  // Accessories only: which pets it suits. Nothing ticked = suits every pet.
  const [petTypes, setPetTypes] = useState<string[]>(product?.pet_types ?? []);
  const togglePet = (v: string) =>
    setPetTypes((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  // Brand comes from the managed Brands list (dropdown). '' = no brand.
  const [brandId, setBrandId] = useState(product?.brand_id != null ? String(product.brand_id) : '');
  // New products can only pick active brands; when editing, keep the current one even if hidden.
  const brandOptions = brands.filter((b) => b.is_active || String(b.id) === brandId);
  const [parentSel, setParentSel] = useState(
    initialCat ? String(initialCat.parent_id ?? initialCat.id) : ''
  );
  const [subSel, setSubSel] = useState(initialCat?.parent_id != null ? String(initialCat.id) : '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const topLevel = cats.filter((c) => c.parent_id == null);
  const subCats = cats.filter((c) => parentSel && String(c.parent_id) === parentSel);
  const resolvedCategoryId = subSel ? Number(subSel) : (parentSel ? Number(parentSel) : null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - images.length);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;
    setErr('');
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await api.uploadImage(f));
      setImages((cur) => [...cur, ...urls].slice(0, MAX_IMAGES));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const labels = variants.map((v) => v.label.trim().toLowerCase());
    if (variants.some((v) => !v.label.trim() || v.original_price === '' || v.discount_price === '' || v.stock_quantity === '')) {
      setErr('Fill in size, original price, discount price and stock for every variant (or remove the row).');
      return;
    }
    if (new Set(labels).size !== labels.length) { setErr('Each variant size must be different.'); return; }
    if (variants.some((v) => Number(v.discount_price) > Number(v.original_price))) {
      setErr('A variant’s discount price cannot be higher than its original price.');
      return;
    }
    setSaving(true);
    // Summary shown in lists: cheapest variant's prices, total stock.
    const cheapest = [...variants].sort((a, b) => Number(a.discount_price) - Number(b.discount_price))[0];
    const body = {
      name: form.name,
      brand_id: brandId ? Number(brandId) : null,
      emoji: form.emoji,
      image_url: images[0] ?? null,
      image_urls: images,
      description: form.description,
      manufacturer_details: form.manufacturer_details,
      ingredients: form.ingredients,
      uses: form.uses,
      category_id: resolvedCategoryId,
      original_price: hasVariants ? Number(cheapest.original_price) : Number(form.original_price),
      discount_price: hasVariants ? Number(cheapest.discount_price) : Number(form.discount_price),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}), label: v.label.trim(),
        original_price: Number(v.original_price), discount_price: Number(v.discount_price),
        stock_quantity: Number(v.stock_quantity),
      })),
      rating: Number(form.rating),
      reviews_count: Number(form.reviews_count),
      stock_quantity: hasVariants ? variants.reduce((n, v) => n + Number(v.stock_quantity), 0) : Number(form.stock_quantity),
      low_stock_threshold: Number(form.low_stock_threshold),
      in_stock: form.in_stock,
      is_featured: form.is_featured,
      is_flash_sale: form.is_flash_sale,
      is_accessory: form.is_accessory,
      // Only meaningful for accessories; cleared otherwise so stale tags don't linger.
      pet_types: form.is_accessory ? petTypes : [],
    };
    try {
      if (isEdit) await api.updateProduct(product!.id, body);
      else await api.createProduct(body);
      onSaved(isEdit ? 'Product updated' : 'Product created');
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section-head">
        <button className="btn ghost" onClick={onClose}>
          <span className="inline-flex items-center gap-1.5"><ArrowLeft size={16} /> Back to products</span>
        </button>
      </div>

      <form className="card" style={{ maxWidth: 760 }} onSubmit={submit}>
        <h2>{isEdit ? `Edit “${product!.name}”` : 'Add new product'}</h2>
        {err && <div className="error">{err}</div>}

        {/* Image gallery */}
        <label>Product images <span className="muted">({images.length}/{MAX_IMAGES} · the first is the main image)</span></label>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {images.map((url, i) => (
            <div key={url + i} style={{ width: 104 }}>
              <div style={{ position: 'relative' }}>
                <img src={url} alt="" className="w-[104px] h-[104px] rounded-xl object-cover border border-[var(--border)]" />
                {i === 0 && (
                  <span style={{ position: 'absolute', left: 6, top: 6, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>MAIN</span>
                )}
                <button
                  type="button" aria-label="Remove image" onClick={() => setImages((cur) => cur.filter((_, idx) => idx !== i))}
                  style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, border: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  <X size={14} />
                </button>
              </div>
              {i > 0 && (
                <button type="button" className="btn ghost sm" style={{ width: '100%', marginTop: 6 }} onClick={() => moveToFront(i)}>Make main</button>
              )}
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-brand-200 rounded-xl hover:bg-brand-50 transition text-center"
              style={{ width: 104, height: 104 }}
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-brand-600" />
              ) : (
                <>
                  <UploadCloud size={22} className="text-brand-500" />
                  <span className="text-xs font-semibold text-ink">{images.length === 0 ? 'Add images' : 'Add more'}</span>
                </>
              )}
            </button>
          )}
        </div>
        <span className="muted" style={{ display: 'block', marginTop: 6 }}>PNG, JPG, WEBP or GIF — up to 5MB each, max {MAX_IMAGES} images.</span>

        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <div className="row">
          <div>
            <label>Brand</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">— no brand —</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.is_active ? '' : ' (hidden)'}</option>
              ))}
            </select>
            {brands.length === 0 && (
              <span className="muted" style={{ display: 'block', marginTop: 4 }}>No brands yet — add one on the Brands page.</span>
            )}
          </div>
          <div><label>Emoji (fallback)</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></div>
        </div>

        <div className="row">
          <div>
            <label>Category</label>
            <select value={parentSel} onChange={(e) => { setParentSel(e.target.value); setSubSel(''); }}>
              <option value="">— none —</option>
              {topLevel.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Sub-category {parentSel && subCats.length === 0 ? '(none yet)' : ''}</label>
            <select value={subSel} onChange={(e) => setSubSel(e.target.value)} disabled={!parentSel || subCats.length === 0}>
              <option value="">— optional —</option>
              {subCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="row">
          <div><label>Original price (₹)</label><input type="number" value={hasVariants ? cheapestOf(variants)?.original_price ?? '' : form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} required={!hasVariants} disabled={hasVariants} /></div>
          <div><label>Discount price (₹)</label><input type="number" value={hasVariants ? cheapestOf(variants)?.discount_price ?? '' : form.discount_price} onChange={(e) => setForm({ ...form, discount_price: e.target.value })} required={!hasVariants} disabled={hasVariants} /></div>
        </div>

        <div className="row">
          <div><label>Rating (0–5)</label><input type="number" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
          <div><label>Reviews count</label><input type="number" value={form.reviews_count} onChange={(e) => setForm({ ...form, reviews_count: e.target.value })} /></div>
        </div>

        <div className="row">
          <div><label>Stock quantity</label><input type="number" value={hasVariants ? variants.reduce((n, v) => n + Number(v.stock_quantity || 0), 0) : form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} disabled={hasVariants} /></div>
          <div><label>Low-stock alert below</label><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
        </div>

        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--primary-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={{ margin: 0 }}>Size variants (optional)</label>
            <button type="button" className="btn ghost sm" onClick={() => setVariants((cur) => [...cur, { ...EMPTY_VARIANT }])}>
              <span className="inline-flex items-center gap-1"><Plus size={13} /> Add size</span>
            </button>
          </div>
          <p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
            {hasVariants
              ? 'Each size has its own price and stock. The price and stock above are calculated from these (lowest price, total stock).'
              : 'For products sold in several pack sizes (e.g. 10kg, 20kg, 500g). Leave empty for a single-size product.'}
          </p>
          {hasVariants && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 0.9fr 32px', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--gray)' }}>
                <span>Size (kg / g)</span><span>Original price (₹)</span><span>Discount price (₹)</span><span>Stock</span><span />
              </div>
              {variants.map((v, i) => (
                <div key={v.id ?? `new-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 0.9fr 32px', gap: 8, alignItems: 'center' }}>
                  <input placeholder="e.g. 10kg" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} maxLength={40} />
                  <input type="number" min={0} value={v.original_price} onChange={(e) => setVariant(i, { original_price: e.target.value })} />
                  <input type="number" min={0} value={v.discount_price} onChange={(e) => setVariant(i, { discount_price: e.target.value })} />
                  <input type="number" min={0} value={v.stock_quantity} onChange={(e) => setVariant(i, { stock_quantity: e.target.value })} />
                  <button type="button" aria-label="Remove size" onClick={() => setVariants((cur) => cur.filter((_, idx) => idx !== i))}
                    style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--danger, #DC2626)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label>Description</label>
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <label>Manufacturer details</label>
        <textarea
          rows={5} maxLength={4000} value={form.manufacturer_details}
          placeholder={'SKU, country of origin, manufacturer name & address, marketed by, contact number…'}
          onChange={(e) => setForm({ ...form, manufacturer_details: e.target.value })}
        />

        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--primary-soft)' }}>
          <label style={{ marginTop: 0 }}>Additional details</label>
          <label>Ingredients</label>
          <textarea
            rows={4} maxLength={4000} value={form.ingredients}
            placeholder="Real Chicken, Lamb, Whole Dried Eggs…"
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
          />
          <label>Uses</label>
          <textarea
            rows={4} maxLength={4000} value={form.uses}
            placeholder="Feeding guidelines, directions, what it is used for…"
            onChange={(e) => setForm({ ...form, uses: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
          <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.in_stock} onChange={(e) => setForm({ ...form, in_stock: e.target.checked })} /> In stock
          </label>
          <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured
          </label>
          <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.is_flash_sale} onChange={(e) => setForm({ ...form, is_flash_sale: e.target.checked })} /> Flash sale
          </label>
          <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.is_accessory} onChange={(e) => setForm({ ...form, is_accessory: e.target.checked })} /> Pet accessory
          </label>
        </div>

        {form.is_accessory && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--primary-soft)' }}>
            <label style={{ marginTop: 0 }}>Suitable for</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PET_TYPE_OPTIONS.map((o) => {
                const on = petTypes.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => togglePet(o.value)}
                    aria-pressed={on}
                    style={{
                      padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                      background: on ? 'var(--primary)' : '#fff', color: on ? '#fff' : 'var(--ink)',
                    }}
                  >
                    {o.emoji} {o.label}
                  </button>
                );
              })}
            </div>
            <p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
              {petTypes.length === 0
                ? 'Nothing selected — this accessory is shown for every pet.'
                : 'Shown to owners of the selected pets (and under each pet’s tab in the app).'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn" disabled={uploading || saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
          <button type="button" className="btn gray" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

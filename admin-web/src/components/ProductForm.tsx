import { useState, useRef, FormEvent } from 'react';
import { ArrowLeft, UploadCloud, Loader2, ImageOff } from 'lucide-react';
import { api } from '../api';
import { Product, Category } from '../types';

interface FormState {
  name: string; brand: string; emoji: string;
  original_price: string; discount_price: string; rating: string;
  reviews_count: string; stock_quantity: string; low_stock_threshold: string;
  description: string; in_stock: boolean; is_featured: boolean; is_flash_sale: boolean;
}

const EMPTY: FormState = {
  name: '', brand: '', emoji: '💊',
  original_price: '', discount_price: '', rating: '4.5',
  reviews_count: '0', stock_quantity: '100', low_stock_threshold: '10',
  description: '', in_stock: true, is_featured: false, is_flash_sale: false,
};

interface Props {
  product: Product | null;       // null → add, otherwise → edit
  cats: Category[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export default function ProductForm({ product, cats, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const initialCat = product ? cats.find((c) => c.id === product.category_id) : undefined;

  const [form, setForm] = useState<FormState>(
    product
      ? {
          name: product.name, brand: product.brand, emoji: product.emoji,
          original_price: String(product.original_price), discount_price: String(product.discount_price),
          rating: String(product.rating), reviews_count: String(product.reviews_count),
          stock_quantity: String(product.stock_quantity), low_stock_threshold: String(product.low_stock_threshold),
          description: product.description, in_stock: product.in_stock, is_featured: product.is_featured,
          is_flash_sale: product.is_flash_sale,
        }
      : EMPTY
  );
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr('');
    setUploading(true);
    try {
      const url = await api.uploadImage(f);
      setImageUrl(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    const body = {
      name: form.name,
      brand: form.brand,
      emoji: form.emoji,
      image_url: imageUrl || null,
      description: form.description,
      category_id: resolvedCategoryId,
      original_price: Number(form.original_price),
      discount_price: Number(form.discount_price),
      rating: Number(form.rating),
      reviews_count: Number(form.reviews_count),
      stock_quantity: Number(form.stock_quantity),
      low_stock_threshold: Number(form.low_stock_threshold),
      in_stock: form.in_stock,
      is_featured: form.is_featured,
      is_flash_sale: form.is_flash_sale,
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

        {/* Image upload */}
        <label>Product image</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {imageUrl ? (
          <div className="flex items-center gap-4">
            <img src={imageUrl} alt="" className="w-24 h-24 rounded-xl object-cover border border-[var(--border)]" />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink">Image attached</span>
              <div className="flex gap-2">
                <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Replace'}
                </button>
                <button type="button" className="btn gray sm" onClick={() => setImageUrl('')}>
                  <span className="inline-flex items-center gap-1"><ImageOff size={13} /> Remove</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-brand-200 rounded-xl py-9 px-4 hover:bg-brand-50 transition text-center"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2 text-brand-600 font-semibold">
                <Loader2 size={20} className="animate-spin" /> Uploading…
              </span>
            ) : (
              <>
                <UploadCloud size={28} className="text-brand-500" />
                <span className="text-sm font-semibold text-ink">Click to upload an image</span>
                <span className="text-xs" style={{ color: 'var(--gray)' }}>PNG, JPG, WEBP or GIF — up to 5MB</span>
              </>
            )}
          </button>
        )}

        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <div className="row">
          <div><label>Brand</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
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
          <div><label>Original price (₹)</label><input type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} required /></div>
          <div><label>Discount price (₹)</label><input type="number" value={form.discount_price} onChange={(e) => setForm({ ...form, discount_price: e.target.value })} required /></div>
        </div>

        <div className="row">
          <div><label>Rating (0–5)</label><input type="number" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
          <div><label>Reviews count</label><input type="number" value={form.reviews_count} onChange={(e) => setForm({ ...form, reviews_count: e.target.value })} /></div>
        </div>

        <div className="row">
          <div><label>Stock quantity</label><input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
          <div><label>Low-stock alert below</label><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
        </div>

        <label>Description</label>
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

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
        </div>

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

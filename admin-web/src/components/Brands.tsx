import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { UploadCloud, Loader2, ImageOff, Search } from 'lucide-react';
import { api } from '../api';
import { Brand } from '../types';

const EMPTY = { name: '', emoji: '🐾', tint: '#D1FAE5', sort_order: 0 };
const HEX = /^#[0-9a-fA-F]{3,8}$/;

/** Round logo (uploaded image) or, failing that, the brand's emoji on its tint. */
export function BrandBadge({ brand, size = 40 }: { brand: Pick<Brand, 'image_url' | 'emoji' | 'tint'>; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size / 2, background: brand.tint, flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: size * 0.5, overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      {brand.image_url
        ? <img src={brand.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : brand.emoji}
    </div>
  );
}

export default function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [imageUrl, setImageUrl] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api.brands()
      .then(setBrands)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };

  const reset = () => { setForm(EMPTY); setImageUrl(''); setEditId(null); setErr(''); };

  const startEdit = (b: Brand) => {
    setEditId(b.id);
    setForm({ name: b.name, emoji: b.emoji, tint: b.tint, sort_order: b.sort_order });
    setImageUrl(b.image_url ?? '');
    setErr('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr('');
    setUploading(true);
    try { setImageUrl(await api.uploadImage(f)); }
    catch (e2) { setErr((e2 as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const name = form.name.trim();
    if (!name) { setErr('Brand name is required.'); return; }
    if (!HEX.test(form.tint.trim())) { setErr('Tint must be a hex colour like #D1FAE5.'); return; }
    setSaving(true);
    // image_url '' (not undefined) tells the server to drop the logo.
    const body = { name, emoji: form.emoji || '🐾', tint: form.tint.trim(), sort_order: Number(form.sort_order) || 0, image_url: imageUrl };
    try {
      if (editId) { await api.updateBrand(editId, body); toast('Brand updated'); }
      else { await api.createBrand(body); toast('Brand created'); }
      reset();
      await load();
    } catch (e2) { setErr((e2 as Error).message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (b: Brand) => {
    setErr('');
    try { await api.updateBrand(b.id, { is_active: !b.is_active }); toast(b.is_active ? 'Brand hidden from the app' : 'Brand is live'); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const remove = async (b: Brand) => {
    if (!confirm(`Delete brand “${b.name}”?`)) return;
    setErr('');
    try { await api.deleteBrand(b.id); toast('Brand deleted'); if (editId === b.id) reset(); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;
  }, [brands, query]);

  const liveCount = brands.filter((b) => b.is_active && b.product_count > 0).length;

  return (
    <div className="panel">
      <form className="card" onSubmit={submit}>
        <h2>{editId ? 'Edit brand' : 'Add brand'}</h2>
        {err && <div className="error">{err}</div>}

        <label>Logo</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {imageUrl ? (
          <div className="flex items-center gap-4">
            <img src={imageUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-[var(--border)]" />
            <div className="flex gap-2">
              <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Replace'}
              </button>
              <button type="button" className="btn gray sm" onClick={() => setImageUrl('')}>
                <span className="inline-flex items-center gap-1"><ImageOff size={13} /> Remove</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-brand-200 rounded-xl py-6 px-4 hover:bg-brand-50 transition text-center"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2 text-brand-600 font-semibold"><Loader2 size={18} className="animate-spin" /> Uploading…</span>
            ) : (
              <>
                <UploadCloud size={24} className="text-brand-500" />
                <span className="text-sm font-semibold text-ink">Upload a logo</span>
                <span className="text-xs" style={{ color: 'var(--gray)' }}>Optional · square works best · up to 5MB</span>
              </>
            )}
          </button>
        )}

        <label>Brand name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Royal Canin" maxLength={80} required />

        <div className="row">
          <div><label>Emoji (if no logo)</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></div>
          <div>
            <label>Colour</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={HEX.test(form.tint) && form.tint.length === 7 ? form.tint : '#D1FAE5'}
                onChange={(e) => setForm({ ...form, tint: e.target.value })}
                style={{ width: 44, height: 40, padding: 2, flex: 'none' }} aria-label="Brand colour" />
              <input value={form.tint} onChange={(e) => setForm({ ...form, tint: e.target.value })} />
            </div>
          </div>
        </div>
        <label>Display order (lower shows first)</label>
        <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn" style={{ flex: 1 }} disabled={saving || uploading}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Create brand'}
          </button>
          {editId && <button type="button" className="btn gray" onClick={reset}>Cancel</button>}
        </div>
        <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
          Brands you add here appear in the <b>Brand</b> dropdown when creating a product. A brand shows on the
          app’s home screen once it is active and has at least one product.
        </p>
      </form>

      <div>
        <div className="section-head">
          <h2>Brands ({brands.length})</h2>
          <div style={{ position: 'relative', width: 240 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--gray)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands" style={{ paddingLeft: 32 }} />
          </div>
        </div>
        <p className="muted" style={{ margin: '-6px 0 12px' }}>{liveCount} of {brands.length} shown on the app’s home screen</p>

        <table>
          <thead>
            <tr><th>Brand</th><th>Products</th><th>Order</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <BrandBadge brand={b} />
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 700 }}>{b.product_count}</span>
                  {(b.total_products ?? 0) > b.product_count && <span className="muted"> (+{(b.total_products ?? 0) - b.product_count} inactive)</span>}
                </td>
                <td className="muted">{b.sort_order}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => toggleActive(b)}
                    className={`tag ${b.is_active ? 'green' : 'red'}`}
                    style={{ border: 0, cursor: 'pointer' }}
                    title={b.is_active ? 'Click to hide from the app' : 'Click to show in the app'}
                  >
                    {b.is_active ? 'Active' : 'Hidden'}
                  </button>
                  {b.is_active && b.product_count === 0 && <div className="muted" style={{ marginTop: 4 }}>No products yet</div>}
                </td>
                <td>
                  <div className="actions">
                    <button className="btn sm" onClick={() => startEdit(b)}>Edit</button>
                    <button className="btn sm danger" onClick={() => remove(b)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={5} className="muted">
                {brands.length === 0 ? 'No brands yet. Add one on the left.' : 'No brands match your search.'}
              </td></tr>
            )}
            {loading && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

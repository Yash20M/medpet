import { useState, FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { Coupon, Category, Product, AdminUserSummary, DiscountType, ConditionType } from '../types';

interface FormState {
  code: string; title: string; description: string;
  discount_type: DiscountType; discount_value: string; max_discount_amount: string;
  min_order_value: string;
  condition_type: ConditionType; condition_value: string;
  user_id: string;
  show_on_ui: boolean; is_active: boolean;
  usage_limit: string; per_user_limit: string;
  valid_from: string; valid_until: string;
}

const EMPTY: FormState = {
  code: '', title: '', description: '',
  discount_type: 'flat', discount_value: '', max_discount_amount: '',
  min_order_value: '0',
  condition_type: 'none', condition_value: '',
  user_id: '',
  show_on_ui: true, is_active: true,
  usage_limit: '', per_user_limit: '1',
  valid_from: '', valid_until: '',
};

// Postgres returns TIMESTAMPTZ as an ISO string — trim to the yyyy-mm-dd an <input type="date"> expects.
const toDateInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');

interface Props {
  coupon: Coupon | null;
  cats: Category[];
  products: Product[];
  users: AdminUserSummary[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export default function CouponForm({ coupon, cats, products, users, onClose, onSaved }: Props) {
  const isEdit = !!coupon;

  const [form, setForm] = useState<FormState>(
    coupon
      ? {
          code: coupon.code, title: coupon.title, description: coupon.description,
          discount_type: coupon.discount_type, discount_value: String(coupon.discount_value),
          max_discount_amount: coupon.max_discount_amount != null ? String(coupon.max_discount_amount) : '',
          min_order_value: String(coupon.min_order_value),
          condition_type: coupon.condition_type, condition_value: coupon.condition_value != null ? String(coupon.condition_value) : '',
          user_id: coupon.user_id != null ? String(coupon.user_id) : '',
          show_on_ui: coupon.show_on_ui, is_active: coupon.is_active,
          usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : '',
          per_user_limit: String(coupon.per_user_limit),
          valid_from: toDateInput(coupon.valid_from), valid_until: toDateInput(coupon.valid_until),
        }
      : EMPTY
  );
  const [categoryIds, setCategoryIds] = useState<number[]>(coupon?.category_ids ?? []);
  const [productIds, setProductIds] = useState<number[]>(coupon?.product_ids ?? []);
  const [userFilter, setUserFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggleCategory = (id: number) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleProduct = (id: number) =>
    setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filteredUsers = users.filter((u) => {
    const q = userFilter.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
  const filteredProducts = products.filter((p) => {
    const q = productFilter.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    const body = {
      code: form.code,
      title: form.title,
      description: form.description,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      min_order_value: form.min_order_value ? Number(form.min_order_value) : 0,
      condition_type: form.condition_type,
      condition_value: form.condition_value ? Number(form.condition_value) : null,
      user_id: form.user_id ? Number(form.user_id) : null,
      show_on_ui: form.show_on_ui,
      is_active: form.is_active,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : 1,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      category_ids: categoryIds,
      product_ids: productIds,
    };
    try {
      if (isEdit) await api.updateCoupon(coupon!.id, body);
      else await api.createCoupon(body);
      onSaved(isEdit ? 'Coupon updated' : 'Coupon created');
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section-head">
        <button className="btn ghost" onClick={onClose}>
          <span className="inline-flex items-center gap-1.5"><ArrowLeft size={16} /> Back to coupons</span>
        </button>
      </div>

      <form className="card" style={{ maxWidth: 820 }} onSubmit={submit}>
        <h2>{isEdit ? `Edit “${coupon!.code}”` : 'Add new coupon'}</h2>
        {err && <div className="error">{err}</div>}

        <div className="row">
          <div>
            <label>Code</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" required />
          </div>
          <div>
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Flat 20% off" required />
          </div>
        </div>

        <label>Description</label>
        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <div className="row">
          <div>
            <label>Discount type</label>
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountType })}>
              <option value="flat">Flat amount (₹)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </div>
          <div>
            <label>Discount value</label>
            <input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required />
          </div>
        </div>

        {form.discount_type === 'percent' && (
          <>
            <label>Max discount cap (₹, optional)</label>
            <input type="number" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="Leave blank for uncapped" />
          </>
        )}

        <label>Minimum order value (₹)</label>
        <input type="number" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} />

        <div className="row">
          <div>
            <label>Order condition</label>
            <select value={form.condition_type} onChange={(e) => setForm({ ...form, condition_type: e.target.value as ConditionType })}>
              <option value="none">No condition</option>
              <option value="first_order">First order only</option>
              <option value="nth_order">Specific order number</option>
              <option value="min_order_count">After N orders (loyalty)</option>
            </select>
          </div>
          {(form.condition_type === 'nth_order' || form.condition_type === 'min_order_count') && (
            <div>
              <label>{form.condition_type === 'nth_order' ? 'Order number' : 'Minimum past orders'}</label>
              <input type="number" min={1} value={form.condition_value} onChange={(e) => setForm({ ...form, condition_value: e.target.value })} required />
            </div>
          )}
        </div>

        <label>Restrict to a specific customer (optional)</label>
        <input
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="Search by name or email…"
          style={{ marginBottom: 6 }}
        />
        <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
          <option value="">— any eligible customer (public) —</option>
          {filteredUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </select>

        <div className="row" style={{ marginTop: 14 }}>
          <div><label>Total usage limit (optional)</label><input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} placeholder="Unlimited" /></div>
          <div><label>Uses per customer</label><input type="number" min={1} value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} /></div>
        </div>

        <div className="row">
          <div><label>Valid from (optional)</label><input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></div>
          <div><label>Valid until (optional)</label><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
        </div>

        <label style={{ marginTop: 16 }}>Restrict to categories (optional)</label>
        <p className="muted" style={{ margin: '0 0 8px' }}>
          If you select any categories or products below, the discount only applies to those matching items in the
          customer&rsquo;s cart — not the whole order. Leave both empty for a store-wide coupon.
        </p>
        <div className="flex flex-wrap gap-2 p-3 rounded-xl" style={{ border: '1.5px solid var(--border)' }}>
          {cats.map((c) => (
            <label key={c.id} className="inline-flex items-center gap-1.5 text-sm" style={{ margin: 0, fontWeight: 500, color: 'var(--ink)' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
              {c.icon} {c.name}{c.parent_name ? ` (${c.parent_name})` : ''}
            </label>
          ))}
          {cats.length === 0 && <span className="muted">No categories yet.</span>}
        </div>

        <label style={{ marginTop: 14 }}>Restrict to products (optional)</label>
        <input value={productFilter} onChange={(e) => setProductFilter(e.target.value)} placeholder="Search products…" style={{ marginBottom: 6 }} />
        <div className="flex flex-col gap-1.5 p-3 rounded-xl max-h-56 overflow-y-auto" style={{ border: '1.5px solid var(--border)' }}>
          {filteredProducts.map((p) => (
            <label key={p.id} className="inline-flex items-center gap-1.5 text-sm" style={{ margin: 0, fontWeight: 500, color: 'var(--ink)' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
              {p.emoji} {p.name}
            </label>
          ))}
          {filteredProducts.length === 0 && <span className="muted">No matching products.</span>}
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 16 }}>
          <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.show_on_ui} onChange={(e) => setForm({ ...form, show_on_ui: e.target.checked })} />
            Show automatically to eligible customers
          </label>
          <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
        </div>
        {!form.show_on_ui && (
          <p className="muted" style={{ marginTop: 6 }}>
            Hidden coupons aren&rsquo;t auto-surfaced, but customers who know the code can still enter it manually.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon'}</button>
          <button type="button" className="btn gray" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

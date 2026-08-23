import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { Coupon, Category, Product, AdminUserSummary } from '../types';
import CouponForm from './CouponForm';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const discountLabel = (c: Coupon): string =>
  c.discount_type === 'percent'
    ? `${c.discount_value}%${c.max_discount_amount ? ` (up to ${rupee(c.max_discount_amount)})` : ''}`
    : rupee(c.discount_value);

const conditionLabel = (c: Coupon): string => {
  switch (c.condition_type) {
    case 'first_order': return '1st order only';
    case 'nth_order': return `Order #${c.condition_value} only`;
    case 'min_order_count': return `After ${c.condition_value}+ orders`;
    default: return '—';
  }
};

export default function Coupons() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [formState, setFormState] = useState<{ coupon: Coupon | null } | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => Promise.all([api.coupons(), api.categories(), api.products(), api.users()])
    .then(([c, cats_, p, u]) => { setItems(c); setCats(cats_); setProducts(p); setUsers(u); })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const remove = async (id: number) => {
    if (!confirm('Delete this coupon?')) return;
    try { await api.deleteCoupon(id); toast('Deleted'); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const { page, setPage, totalPages, total, pageItems, pageSize } = usePagination(items, 10);

  if (formState) {
    return (
      <CouponForm
        coupon={formState.coupon}
        cats={cats}
        products={products}
        users={users}
        onClose={() => setFormState(null)}
        onSaved={(m) => { setFormState(null); toast(m); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="section-head">
        <h2>Coupons ({items.length})</h2>
        <button className="btn" onClick={() => setFormState({ coupon: null })}>
          <span className="inline-flex items-center gap-1.5"><Plus size={16} /> Add coupon</span>
        </button>
      </div>

      {err && <div className="error">{err}</div>}

      <table>
        <thead><tr><th>Code</th><th>Title</th><th>Discount</th><th>Condition</th><th>Usage</th><th>Visibility</th><th></th></tr></thead>
        <tbody>
          {pageItems.map((c) => (
            <tr key={c.id}>
              <td><strong>{c.code}</strong></td>
              <td>
                {c.title}
                {!c.is_active && <div><span className="tag gray">Inactive</span></div>}
                {(c.category_ids.length > 0 || c.product_ids.length > 0) && (
                  <div className="muted">{c.category_ids.length} categories · {c.product_ids.length} products</div>
                )}
              </td>
              <td>{discountLabel(c)}</td>
              <td className="muted">{conditionLabel(c)}</td>
              <td>
                {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                {c.user_id && <div><span className="tag gray">1 user only</span></div>}
              </td>
              <td>{c.show_on_ui ? <span className="tag green">Shown</span> : <span className="tag gray">Code only</span>}</td>
              <td className="actions">
                <button className="btn ghost sm" onClick={() => setFormState({ coupon: c })}>Edit</button>
                <button className="btn gray sm" onClick={() => remove(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} className="muted">No coupons yet.</td></tr>}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

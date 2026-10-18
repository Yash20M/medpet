import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { Product, Category, Brand, petTypesLabel } from '../types';
import ProductDetail from './ProductDetail';
import ProductForm from './ProductForm';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [viewingId, setViewingId] = useState<number | null>(null);
  // Add/edit form page: null = closed, { product: null } = add, { product } = edit.
  const [formState, setFormState] = useState<{ product: Product | null } | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => Promise.all([api.products(), api.categories(), api.brands()])
    .then(([p, c, b]) => { setItems(p); setCats(c); setBrands(b); })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const remove = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try { await api.deleteProduct(id); toast('Deleted'); setViewingId(null); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const [kind, setKind] = useState<'all' | 'products' | 'accessories'>('all');
  const shown = items.filter((p) => kind === 'all' || (kind === 'accessories') === p.is_accessory);
  const accessoryCount = items.filter((p) => p.is_accessory).length;

  const { page, setPage, totalPages, total, pageItems, pageSize } = usePagination(shown, 10);

  // ── Separate Add / Edit page ──
  if (formState) {
    return (
      <ProductForm
        product={formState.product}
        cats={cats}
        brands={brands}
        onClose={() => setFormState(null)}
        onSaved={(m) => { setFormState(null); toast(m); load(); }}
      />
    );
  }

  // ── Full-page detail view ──
  const viewing = viewingId != null ? items.find((p) => p.id === viewingId) ?? null : null;
  if (viewing) {
    return (
      <ProductDetail
        product={viewing}
        onBack={() => setViewingId(null)}
        onEdit={(p) => { setViewingId(null); setFormState({ product: p }); }}
        onDelete={remove}
      />
    );
  }

  // ── List ──
  return (
    <div>
      <div className="section-head">
        <h2>Products ({items.length})</h2>
        <button className="btn" onClick={() => setFormState({ product: null })}>
          <span className="inline-flex items-center gap-1.5"><Plus size={16} /> Add product</span>
        </button>
      </div>

      {err && <div className="error">{err}</div>}

      <div style={{ display: 'flex', gap: 8, margin: '0 0 14px' }}>
        {([
          ['all', `All (${items.length})`],
          ['products', `Products (${items.length - accessoryCount})`],
          ['accessories', `Accessories (${accessoryCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn sm ${kind === key ? '' : 'gray'}`}
            onClick={() => { setKind(key); setPage(1); }}
          >
            {label}
          </button>
        ))}
      </div>

      <table>
        <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Flags</th><th></th></tr></thead>
        <tbody>
          {pageItems.map((p) => (
            <tr key={p.id}>
              <td style={{ fontSize: 22 }}>
                {p.image_url
                  ? <img src={p.image_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />
                  : p.emoji}
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="muted">{p.brand}</div>
                {p.is_accessory && <div className="muted">🎀 Accessory · {petTypesLabel(p.pet_types)}</div>}
              </td>
              <td className="muted">{p.category_name ?? '—'}</td>
              <td>
                <strong>{rupee(p.discount_price)}</strong>{' '}
                <span className="strike">{rupee(p.original_price)}</span>
                {p.discount_percent > 0 && <div><span className="tag red">{p.discount_percent}% OFF</span></div>}
              </td>
              <td>
                <strong>{p.stock_quantity}</strong>
                {p.stock_quantity <= p.low_stock_threshold && <div><span className="tag red">Low</span></div>}
              </td>
              <td>
                {p.is_featured && <span className="tag green">Featured</span>}{' '}
                {p.in_stock ? <span className="tag gray">In stock</span> : <span className="tag red">Out</span>}
              </td>
              <td className="actions">
                <button className="btn sm" onClick={() => setViewingId(p.id)}>View</button>
                <button className="btn ghost sm" onClick={() => setFormState({ product: p })}>Edit</button>
                <button className="btn gray sm" onClick={() => remove(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr><td colSpan={7} className="muted">
              {items.length === 0 ? 'No products yet.' : kind === 'accessories' ? 'No accessories yet — tick “Pet accessory” when adding a product.' : 'Nothing here.'}
            </td></tr>
          )}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { Product } from '../types';

export default function Inventory() {
  const [items, setItems] = useState<Product[]>([]);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.products().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000); };

  const saveStock = async (p: Product) => {
    const raw = edits[p.id];
    if (raw === undefined) return;
    const qty = Number(raw);
    if (Number.isNaN(qty) || qty < 0) { setErr('Stock must be a non-negative number.'); return; }
    try {
      await api.updateProduct(p.id, { stock_quantity: qty });
      setEdits((e) => { const n = { ...e }; delete n[p.id]; return n; });
      toast(`${p.name} stock updated to ${qty}`);
      load();
    } catch (e) { setErr((e as Error).message); }
  };

  const visible = showLowOnly ? items.filter((p) => p.stock_quantity <= p.low_stock_threshold) : items;
  const lowCount = items.filter((p) => p.stock_quantity <= p.low_stock_threshold).length;

  return (
    <div>
      <div className="section-head">
        <h2>Inventory ({items.length} products)</h2>
        <label style={{ display: 'flex', gap: 6, margin: 0, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={showLowOnly} onChange={(e) => setShowLowOnly(e.target.checked)} />
          Show low stock only {lowCount > 0 && `(${lowCount})`}
        </label>
      </div>

      {err && <div className="error">{err}</div>}

      <table>
        <thead>
          <tr><th></th><th>Name</th><th>Category</th><th>In stock</th><th>Low-stock alert</th><th>Status</th><th>Update stock</th></tr>
        </thead>
        <tbody>
          {visible.map((p) => {
            const low = p.stock_quantity <= p.low_stock_threshold;
            return (
              <tr key={p.id}>
                <td style={{ fontSize: 20 }}>{p.emoji}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted">{p.brand}</div>
                </td>
                <td className="muted">{p.category_name ?? '—'}</td>
                <td><strong>{p.stock_quantity}</strong></td>
                <td className="muted">{p.low_stock_threshold}</td>
                <td>
                  {!p.in_stock ? <span className="tag red">Out of stock</span>
                    : low ? <span className="tag gray">Low stock</span>
                    : <span className="tag green">Healthy</span>}
                </td>
                <td>
                  <div className="actions">
                    <input
                      type="number"
                      style={{ width: 80 }}
                      placeholder={String(p.stock_quantity)}
                      value={edits[p.id] ?? ''}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button className="btn sm" onClick={() => saveStock(p)} disabled={edits[p.id] === undefined}>Save</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {visible.length === 0 && <tr><td colSpan={7} className="muted">No products to show.</td></tr>}
        </tbody>
      </table>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

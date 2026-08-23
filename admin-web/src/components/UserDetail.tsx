import { useEffect, useState } from 'react';
import { api } from '../api';
import { AdminUserSummary, Order } from '../types';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const STATUS_TAG: Record<string, string> = {
  pending: 'gray', confirmed: 'green', shipped: 'green', delivered: 'green', cancelled: 'red',
};

interface Props {
  userId: number;
  fallback: AdminUserSummary;
  onBack: () => void;
}

export default function UserDetail({ userId, fallback, onBack }: Props) {
  const [data, setData] = useState<{ user: AdminUserSummary; orders: Order[] } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.userDetail(userId).then(setData).catch((e) => setErr(e.message));
  }, [userId]);

  const u = data?.user ?? fallback;
  const orders = data?.orders ?? [];

  return (
    <div>
      <div className="section-head">
        <button className="btn ghost" onClick={onBack}>← Back to users</button>
      </div>

      {err && <div className="error">{err}</div>}

      <div className="od-grid">
        <div className="od-side">
          <div className="card">
            <div className="od-id">{u.name}</div>
            <div className="muted" style={{ marginBottom: 10 }}>
              {u.role === 'admin' ? <span className="tag green">Admin</span> : <span className="tag gray">Customer</span>}
            </div>
            <div className="detail-line"><span className="muted">Email</span><span>{u.email}</span></div>
            <div className="detail-line"><span className="muted">Phone</span><span>{u.phone ?? '—'}</span></div>
            <div className="detail-line"><span className="muted">Joined</span><span>{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
          </div>

          <div className="card">
            <h2>Lifetime stats</h2>
            <div className="detail-line"><span className="muted">Orders</span><strong>{u.order_count}</strong></div>
            <div className="detail-line"><span className="muted">Total spent</span><strong>{rupee(u.total_spent)}</strong></div>
            <div className="detail-line"><span className="muted">Wishlist items</span><span>{u.wishlist_count}</span></div>
          </div>
        </div>

        <div className="card">
          <h2>Order history ({orders.length})</h2>
          <table>
            <thead><tr><th>#</th><th>Status</th><th>Items</th><th>Total</th><th>Placed</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td><span className={`tag ${STATUS_TAG[o.status] ?? 'gray'}`}>{o.status}</span></td>
                  <td className="muted">{o.item_count}</td>
                  <td><strong>{rupee(o.total)}</strong></td>
                  <td className="muted">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                </tr>
              ))}
              {data && orders.length === 0 && <tr><td colSpan={5} className="muted">No orders yet.</td></tr>}
              {!data && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

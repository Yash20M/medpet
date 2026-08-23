import { useEffect, useState } from 'react';
import { api } from '../api';
import { AdminOrder, OrderStatus } from '../types';
import OrderDetail from './OrderDetail';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'gray', confirmed: 'green', shipped: 'green', delivered: 'green', cancelled: 'red',
};

// Address is stored as "Recipient name\nfull address" — show the first address line.
const addressLine = (address: string): string => {
  if (!address) return '';
  const parts = address.split('\n');
  return parts.length > 1 ? parts[1] : parts[0];
};

export default function Orders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | ''>('');
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async (): Promise<AdminOrder[]> => {
    try {
      const data = await api.orders(filter || undefined);
      setOrders(data);
      return data;
    } catch (e) {
      setErr((e as Error).message);
      return [];
    }
  };
  useEffect(() => { load(); }, [filter]);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000); };

  const changeStatus = async (id: number, status: OrderStatus) => {
    try {
      await api.updateOrderStatus(id, status);
      toast(`Order #${id} marked ${status}`);
      await load();
    } catch (e) { setErr((e as Error).message); }
  };

  const { page, setPage, totalPages, total, pageItems, pageSize } = usePagination(orders, 10);

  // Full-page detail view.
  const viewing = viewingId != null ? orders.find((o) => o.id === viewingId) ?? null : null;
  if (viewing) {
    return <OrderDetail order={viewing} onBack={() => setViewingId(null)} onStatusChange={changeStatus} />;
  }

  return (
    <div>
      <div className="section-head">
        <h2>Orders ({orders.length})</h2>
        <select style={{ width: 180 }} value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | '')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {err && <div className="error">{err}</div>}

      <table>
        <thead>
          <tr>
            <th>#</th><th>Customer</th><th>Delivery location</th><th>Partner</th><th>Items</th>
            <th>Total</th><th>Payment</th><th>Status</th><th>Placed</th><th></th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((o) => {
            const hasGeo = o.latitude != null && o.longitude != null;
            const line = addressLine(o.address);
            return (
              <tr key={o.id}>
                <td><strong>#{o.id}</strong></td>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.user_name}</div>
                  <div className="muted">{o.user_email}</div>
                </td>
                <td>
                  <div className="loc-cell">{line || <span className="muted">No address</span>}</div>
                  {hasGeo && (
                    <a className="map-pin" href={`https://www.google.com/maps?q=${Number(o.latitude)},${Number(o.longitude)}`} target="_blank" rel="noreferrer">
                      📍 Map
                    </a>
                  )}
                </td>
                <td className="muted">{o.delivery_partner_name ?? '—'}</td>
                <td className="muted">{o.item_count} item{o.item_count === 1 ? '' : 's'}</td>
                <td><strong>{rupee(o.total)}</strong></td>
                <td>
                  <span className={`tag ${o.payment_method === 'cod' ? 'gray' : 'green'}`}>
                    {o.payment_method === 'cod' ? 'COD' : 'UPI'}
                  </span>
                </td>
                <td><span className={`tag ${STATUS_TAG[o.status]}`}>{o.status}</span></td>
                <td className="muted">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td><button className="btn sm" onClick={() => setViewingId(o.id)}>View</button></td>
              </tr>
            );
          })}
          {orders.length === 0 && <tr><td colSpan={10} className="muted">No orders found.</td></tr>}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

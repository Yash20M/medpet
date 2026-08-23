import { AdminOrder, OrderStatus } from '../types';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'gray', confirmed: 'green', shipped: 'green', delivered: 'green', cancelled: 'red',
};
const PAYMENT_LABEL: Record<string, string> = { upi: 'UPI', cod: 'Cash on Delivery' };

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

// Address is stored as "Recipient name\nfull address".
const splitAddress = (address: string): { name: string | null; lines: string } => {
  if (!address) return { name: null, lines: '' };
  const [first, ...rest] = address.split('\n');
  return rest.length ? { name: first, lines: rest.join('\n') } : { name: null, lines: first };
};

interface Props {
  order: AdminOrder;
  onBack: () => void;
  onStatusChange: (id: number, status: OrderStatus) => void;
}

export default function OrderDetail({ order, onBack, onStatusChange }: Props) {
  const hasGeo = order.latitude != null && order.longitude != null;
  const lat = Number(order.latitude);
  const lng = Number(order.longitude);
  const addr = splitAddress(order.address);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div>
      <div className="section-head">
        <button className="btn ghost" onClick={onBack}>← Back to orders</button>
      </div>

      {/* Header */}
      <div className="card od-header">
        <div>
          <div className="od-id">Order #{order.id}</div>
          <div className="muted">Placed {fmtDateTime(order.created_at)}</div>
        </div>
        <div className="od-header-right">
          <span className={`tag ${STATUS_TAG[order.status]}`}>{order.status}</span>
          <select value={order.status} onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)} style={{ width: 150 }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="od-grid">
        {/* Products */}
        <div className="card">
          <h2>Products ({order.item_count})</h2>
          <div className="od-items">
            {order.items.map((it) => (
              <div key={it.id} className="od-item">
                {it.image_url
                  ? <img className="od-thumb" src={it.image_url} alt={it.name} />
                  : <div className="od-thumb od-emoji">{it.emoji}</div>}
                <div className="od-item-info">
                  <div className="od-item-name">{it.name}</div>
                  <div className="muted">{rupee(it.price)} × {it.quantity}</div>
                </div>
                <div className="od-item-total">{rupee(it.price * it.quantity)}</div>
              </div>
            ))}
          </div>

          <div className="od-totals">
            <div><span className="muted">Subtotal</span><span>{rupee(order.subtotal)}</span></div>
            <div><span className="muted">Delivery</span><span>{order.delivery_fee === 0 ? 'FREE' : rupee(order.delivery_fee)}</span></div>
            {order.discount > 0 && (
              <div><span className="muted">Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span><span>−{rupee(order.discount)}</span></div>
            )}
            <div className="grand"><span>Total</span><span>{rupee(order.total)}</span></div>
          </div>
        </div>

        {/* Customer, delivery & payment */}
        <div className="od-side">
          <div className="card">
            <h2>Customer</h2>
            <div className="detail-line"><span className="muted">Name</span><strong>{addr.name ?? order.user_name}</strong></div>
            <div className="detail-line"><span className="muted">Account</span><span>{order.user_name}</span></div>
            <div className="detail-line"><span className="muted">Email</span><span>{order.user_email}</span></div>
            <div className="detail-line"><span className="muted">Phone</span><span>{order.contact_phone || '—'}</span></div>
          </div>

          <div className="card">
            <h2>Delivery Location</h2>
            <div className="addr-text">{addr.lines || <span className="muted">No address provided</span>}</div>
            {hasGeo ? (
              <>
                <a className="btn map-btn" href={mapsUrl} target="_blank" rel="noreferrer">📍 Open in Google Maps</a>
                <iframe
                  className="od-map"
                  title="Delivery location"
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                />
                <div className="muted coords">GPS: {lat.toFixed(5)}, {lng.toFixed(5)}</div>
              </>
            ) : (
              <div className="muted">No GPS location pinned for this order.</div>
            )}
          </div>

          <div className="card">
            <h2>Payment</h2>
            <div className="detail-line">
              <span className="muted">Method</span>
              <span className={`tag ${order.payment_method === 'cod' ? 'gray' : 'green'}`}>
                {PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
              </span>
            </div>
            <div className="detail-line"><span className="muted">Amount</span><strong>{rupee(order.total)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

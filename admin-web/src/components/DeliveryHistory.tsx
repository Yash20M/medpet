import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { DeliveryHistory as History, DeliveryPartner } from '../types';
import Pagination from './Pagination';

const PAGE_SIZE = 20;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const prettyDay = (v: string) =>
  new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const prettyTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const addressLine = (a: string) => {
  const parts = (a || '').split('\n');
  return (parts.length > 1 ? parts.slice(1).join(', ') : parts[0]).trim() || '—';
};

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'Today', range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { label: 'Last 7 days', range: () => ({ from: daysAgo(6), to: ymd(new Date()) }) },
  { label: 'Last 30 days', range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { label: 'This month', range: () => { const n = new Date(); return { from: ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: ymd(n) }; } },
];

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-white border px-4 py-3 flex-1 min-w-[150px]" style={{ borderColor: 'var(--border)' }}>
      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--gray)' }}>{label}</div>
      <div className="text-xl font-extrabold leading-tight mt-0.5" style={{ color: tone }}>{value}</div>
    </div>
  );
}

export default function DeliveryHistory() {
  const initial = useMemo(() => PRESETS[1].range(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [partnerId, setPartnerId] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { api.deliveryPartners().then(setPartners).catch(() => {}); }, []);

  useEffect(() => {
    if (!from || !to) return;
    if (from > to) { setErr('"From" date must be on or before "To" date.'); return; }
    let cancelled = false;
    setLoading(true);
    setErr('');
    api.deliveryHistory({ from, to, partnerId: partnerId === '' ? undefined : partnerId, page, limit: PAGE_SIZE })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: Error) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, partnerId, page]);

  const applyPreset = (r: { from: string; to: string }) => { setFrom(r.from); setTo(r.to); setPage(1); };
  const s = data?.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Filters */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label style={{ marginTop: 0 }}>From</label>
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label style={{ marginTop: 0 }}>To</label>
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label style={{ marginTop: 0 }}>Delivery partner</label>
            <select value={partnerId} onChange={(e) => { setPartnerId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
              <option value="">All partners</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn sm gray" onClick={() => applyPreset(p.range())}>{p.label}</button>
            ))}
          </div>
        </div>
        {err && <div className="error" style={{ marginTop: 12, marginBottom: 0 }}>{err}</div>}
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        <Kpi label="Accepted" value={s ? String(s.accepted) : '—'} tone="var(--ink)" />
        <Kpi label="Delivered" value={s ? String(s.delivered) : '—'} tone="#059669" />
        <Kpi label="Still out for delivery" value={s ? String(s.active) : '—'} tone="#7C3AED" />
        <Kpi label="Delivered value" value={s ? rupee(s.delivered_value) : '—'} tone="var(--ink)" />
        <Kpi label="COD collected" value={s ? rupee(s.cod_collected) : '—'} tone="#0EA5E9" />
      </div>

      {data && partnerId === '' && data.by_partner.length > 0 && (
        <div>
          <div className="section-head"><h2>By partner</h2></div>
          <table>
            <thead><tr><th>Partner</th><th>Accepted</th><th>Delivered</th><th>Delivered value</th><th></th></tr></thead>
            <tbody>
              {data.by_partner.map((p) => (
                <tr key={p.partner_id}>
                  <td style={{ fontWeight: 600 }}>{p.partner_name}</td>
                  <td>{p.accepted}</td>
                  <td>{p.delivered}</td>
                  <td>{rupee(p.value)}</td>
                  <td><button className="btn sm gray" onClick={() => { setPartnerId(p.partner_id); setPage(1); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.daily.length > 0 && (
        <div>
          <div className="section-head"><h2>By day</h2></div>
          <table>
            <thead><tr><th>Date accepted</th><th>Accepted</th><th>Delivered</th><th>Delivered value</th></tr></thead>
            <tbody>
              {data.daily.map((d) => (
                <tr key={d.date}>
                  <td style={{ fontWeight: 600 }}>{prettyDay(d.date)}</td>
                  <td>{d.accepted}</td>
                  <td>{d.delivered}</td>
                  <td>{rupee(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <div className="section-head">
          <h2>Accepted deliveries{data ? ` (${data.pagination.total})` : ''}</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Order</th><th>Partner</th><th>Customer</th><th>Address</th>
              <th>Accepted</th><th>Delivered</th><th>Status</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((o) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 700 }}>#{o.id}</td>
                <td>{o.partner_name}</td>
                <td>{o.customer_name}</td>
                <td className="loc-cell">{addressLine(o.address)}</td>
                <td className="muted">{prettyTime(o.accepted_at)}</td>
                <td className="muted">{o.delivered_at ? prettyTime(o.delivered_at) : '—'}</td>
                <td>
                  {o.status === 'delivered'
                    ? <span className="tag green">Delivered</span>
                    : <span className="tag gray">Out for delivery</span>}
                </td>
                <td>{rupee(o.total)} <span className="muted">· {o.payment_method.toUpperCase()}</span></td>
              </tr>
            ))}
            {loading && <tr><td colSpan={8} className="muted">Loading…</td></tr>}
            {!loading && data && data.orders.length === 0 && (
              <tr><td colSpan={8} className="muted">No deliveries were accepted in this date range.</td></tr>
            )}
          </tbody>
        </table>
        {data && (
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.total_pages}
            total={data.pagination.total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

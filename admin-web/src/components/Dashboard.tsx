import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../api';
import { DashboardSummary } from '../types';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_TAG: Record<string, string> = {
  pending: 'gray', confirmed: 'green', shipped: 'green', delivered: 'green', cancelled: 'red',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#9CA3AF', confirmed: '#3B82F6', shipped: '#F59E0B', delivered: '#22C55E', cancelled: '#E63946',
};

const fmtDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="error">{err}</div>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const stats = [
    { label: 'Total Revenue', value: rupee(data.total_revenue), sub: `${rupee(data.revenue_today)} today` },
    { label: 'Total Orders', value: data.total_orders, sub: `${data.orders_today} today` },
    { label: 'Total Users', value: data.total_users, sub: 'registered customers' },
    { label: 'Products', value: data.total_products, sub: `${data.low_stock_count} low on stock` },
  ];

  const series = data.revenue_series.map((d) => ({ ...d, label: fmtDay(d.date) }));

  return (
    <div>
      <div className="section-head"><h2>Dashboard</h2></div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="card stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="muted">{s.sub}</div>
          </div>
        ))}
      </div>

      {data.low_stock_count > 0 && (
        <div className="error" style={{ marginTop: 16 }}>
          ⚠ {data.low_stock_count} product{data.low_stock_count === 1 ? '' : 's'} running low on stock — check the Inventory tab.
        </div>
      )}

      <div className="chart-grid" style={{ marginTop: 20 }}>
        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h2>Revenue — last 14 days</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E63946" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#E63946" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip formatter={(value) => rupee(Number(value))} />
              <Area type="monotone" dataKey="revenue" stroke="#E63946" fill="url(#revFill)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h2>Orders by Status</h2>
          {data.orders_by_status.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.orders_by_status}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {data.orders_by_status.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? '#9CA3AF'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card chart-card" style={{ gridColumn: 'span 4' }}>
          <h2>Top Products — units sold</h2>
          {data.top_products.length === 0 ? (
            <p className="muted">No sales yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.top_products} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#1A1A2E' }} axisLine={false} tickLine={false} width={140} />
                <Tooltip />
                <Bar dataKey="units_sold" fill="#E63946" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="card">
          <h2>Recent Orders</h2>
          <table>
            <thead><tr><th>#</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {data.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.user_name}</td>
                  <td><span className={`tag ${STATUS_TAG[o.status] ?? 'gray'}`}>{o.status}</span></td>
                  <td>{rupee(o.total)}</td>
                </tr>
              ))}
              {data.recent_orders.length === 0 && <tr><td colSpan={4} className="muted">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Top Products</h2>
          <table>
            <thead><tr><th></th><th>Name</th><th>Units sold</th></tr></thead>
            <tbody>
              {data.top_products.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontSize: 20 }}>{p.emoji}</td>
                  <td>{p.name}</td>
                  <td>{p.units_sold}</td>
                </tr>
              ))}
              {data.top_products.length === 0 && <tr><td colSpan={3} className="muted">No sales yet.</td></tr>}
            </tbody>
          </table>

          <h2 style={{ marginTop: 18 }}>Orders by Status</h2>
          <div className="actions" style={{ flexWrap: 'wrap', gap: 8 }}>
            {data.orders_by_status.map((s) => (
              <span key={s.status} className={`tag ${STATUS_TAG[s.status] ?? 'gray'}`}>{s.status}: {s.count}</span>
            ))}
            {data.orders_by_status.length === 0 && <span className="muted">No orders yet.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

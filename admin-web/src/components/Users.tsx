import { useEffect, useState } from 'react';
import { api } from '../api';
import { AdminUserSummary } from '../types';
import UserDetail from './UserDetail';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function Users() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.users().then(setUsers).catch((e) => setErr(e.message)); }, []);

  const visible = users.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const { page, setPage, totalPages, total, pageItems, pageSize } = usePagination(visible, 12);

  const viewing = viewingId != null ? users.find((u) => u.id === viewingId) ?? null : null;
  if (viewing) {
    return <UserDetail userId={viewing.id} fallback={viewing} onBack={() => setViewingId(null)} />;
  }

  return (
    <div>
      <div className="section-head">
        <h2>Users ({users.length})</h2>
        <input
          style={{ width: 220 }}
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {err && <div className="error">{err}</div>}

      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Orders</th><th>Total spent</th><th>Wishlist</th><th>Joined</th><th></th></tr></thead>
        <tbody>
          {pageItems.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.name}</td>
              <td className="muted">{u.email}</td>
              <td className="muted">{u.phone ?? '—'}</td>
              <td>
                {u.role === 'admin' ? <span className="tag green">Admin</span>
                  : u.role === 'delivery' ? <span className="tag" style={{ background: '#FFEDD5', color: '#9A3412' }}>Delivery</span>
                  : <span className="tag gray">Customer</span>}
              </td>
              <td>{u.order_count}</td>
              <td>{rupee(u.total_spent)}</td>
              <td className="muted">{u.wishlist_count}</td>
              <td className="muted">{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td><button className="btn sm" onClick={() => setViewingId(u.id)}>View</button></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={9} className="muted">No users found.</td></tr>}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

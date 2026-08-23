import { useState, FormEvent } from 'react';
import { api } from '../api';

export default function Notifications() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('general');
  const [userId, setUserId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setSending(true);
    try {
      await api.sendNotification({
        title, body, type,
        userId: userId.trim() ? Number(userId) : null,
      });
      setMsg('Notification sent ✓'); setTimeout(() => setMsg(''), 2500);
      setTitle(''); setBody('');
    } catch (e) { setErr((e as Error).message); }
    finally { setSending(false); }
  };

  return (
    <div className="panel">
      <form className="card" onSubmit={submit}>
        <h2>Push a notification</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Delivered instantly to connected apps over SSE and saved to the user's inbox.
        </p>
        {err && <div className="error">{err}</div>}
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Flat 30% off this weekend!" />
        <label>Body</label>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Stock up on pet medicines…" />
        <div className="row">
          <div>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="general">General</option>
              <option value="offer">Offer</option>
              <option value="order">Order</option>
              <option value="restock">Restock</option>
            </select>
          </div>
          <div>
            <label>User ID (blank = all users)</label>
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. 5" />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 16 }} disabled={sending}>
          {sending ? 'Sending…' : userId.trim() ? 'Send to user' : 'Broadcast to all'}
        </button>
      </form>

      <div className="card">
        <h2>How it works</h2>
        <ul className="muted" style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>The app subscribes to <code>GET /api/notifications/stream?token=…</code> (Server-Sent Events).</li>
          <li>Sending here inserts a row and pushes a <code>notification</code> event to matching clients in real time.</li>
          <li>Leave <b>User ID</b> blank to broadcast to everyone; set it to target one user.</li>
          <li>Users fetch history at <code>GET /api/notifications</code> and mark read via <code>PATCH /api/notifications/:id/read</code>.</li>
        </ul>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';
import { Offer } from '../types';

const EMPTY = {
  title: '', subtitle: '', badge: 'OFFER', code: '', emoji: '🎁',
  color_from: '#E63946', color_to: '#A4121A', sort_order: 0,
};

export default function Offers() {
  const [items, setItems] = useState<Offer[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.offers().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const body = { ...form, sort_order: Number(form.sort_order) };
      if (editId) { await api.updateOffer(editId, body); toast('Offer updated'); }
      else { await api.createOffer(body); toast('Offer created'); }
      setForm(EMPTY); setEditId(null); load();
    } catch (e) { setErr((e as Error).message); }
  };

  const edit = (o: Offer) => {
    setEditId(o.id);
    setForm({
      title: o.title, subtitle: o.subtitle, badge: o.badge, code: o.code ?? '',
      emoji: o.emoji, color_from: o.color_from, color_to: o.color_to, sort_order: o.sort_order,
    });
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this offer?')) return;
    try { await api.deleteOffer(id); toast('Deleted'); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="panel">
      <form className="card" onSubmit={submit}>
        <h2>{editId ? 'Edit offer' : 'Add offer / banner'}</h2>
        {err && <div className="error">{err}</div>}
        <label>Title</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <label>Subtitle</label>
        <textarea rows={2} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        <div className="row">
          <div><label>Badge</label><input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} /></div>
          <div><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><label>Emoji</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></div>
        </div>
        <div className="row">
          <div><label>Gradient from</label><input value={form.color_from} onChange={(e) => setForm({ ...form, color_from: e.target.value })} /></div>
          <div><label>Gradient to</label><input value={form.color_to} onChange={(e) => setForm({ ...form, color_to: e.target.value })} /></div>
          <div><label>Order</label><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn">{editId ? 'Save' : 'Create'}</button>
          {editId && <button type="button" className="btn gray" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      <div>
        <div className="section-head"><h2>Offers ({items.length})</h2></div>
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((o) => (
            <div key={o.id} style={{
              borderRadius: 14, padding: 18, color: '#fff',
              background: `linear-gradient(90deg, ${o.color_from}, ${o.color_to})`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ background: 'rgba(255,255,255,.25)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{o.badge}</span>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{o.emoji} {o.title}</div>
                <div style={{ opacity: .85, fontSize: 13, whiteSpace: 'pre-line' }}>{o.subtitle}</div>
                {o.code && <div style={{ fontSize: 12, marginTop: 4 }}>Code: <b>{o.code}</b></div>}
              </div>
              <div className="actions">
                <button className="btn sm" style={{ background: 'rgba(255,255,255,.25)' }} onClick={() => edit(o)}>Edit</button>
                <button className="btn sm" style={{ background: 'rgba(0,0,0,.25)' }} onClick={() => remove(o.id)}>Delete</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="muted">No offers yet.</p>}
        </div>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

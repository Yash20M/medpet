import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';
import { Category } from '../types';

const EMPTY = { name: '', slug: '', icon: '🐾', image_url: '', parent_id: '', color: '#FDE8EA', icon_bg: '#F8B7BE', sort_order: 0 };

export default function Categories() {
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.categories().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  // Only top-level categories can be parents (one level of nesting).
  const topLevel = items.filter((c) => c.parent_id == null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const body = {
        ...form,
        image_url: form.image_url || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        sort_order: Number(form.sort_order),
      };
      if (editId) { await api.updateCategory(editId, body); toast('Category updated'); }
      else { await api.createCategory(body); toast('Category created'); }
      setForm(EMPTY); setEditId(null); load();
    } catch (e) { setErr((e as Error).message); }
  };

  const edit = (c: Category) => {
    setEditId(c.id);
    setForm({
      name: c.name, slug: c.slug, icon: c.icon, image_url: c.image_url ?? '',
      parent_id: c.parent_id ? String(c.parent_id) : '',
      color: c.color, icon_bg: c.icon_bg, sort_order: c.sort_order,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this category? Sub-categories under it will also be removed.')) return;
    try { await api.deleteCategory(id); toast('Deleted'); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  // Render parents first, each followed by its sub-categories.
  const ordered: Category[] = [];
  topLevel.forEach((p) => {
    ordered.push(p);
    items.filter((c) => c.parent_id === p.id).forEach((s) => ordered.push(s));
  });

  return (
    <div className="panel">
      <form className="card" onSubmit={submit}>
        <h2>{editId ? 'Edit category' : 'Add category / sub-category'}</h2>
        {err && <div className="error">{err}</div>}

        <label>Parent category (leave empty for a top-level category)</label>
        <select
          value={form.parent_id}
          onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
        >
          <option value="">— none (top-level) —</option>
          {topLevel.filter((c) => c.id !== editId).map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>

        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.parent_id ? 'e.g. German Shepherd' : 'e.g. Dogs'} required />

        <label>Slug (optional — auto from name)</label>
        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="german-shepherd" />

        <div className="row">
          <div><label>Icon (emoji)</label><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
          <div><label>Sort order</label><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
        </div>

        <label>Image URL (shown in the app instead of the emoji)</label>
        <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://images.unsplash.com/..." />

        <div className="row">
          <div><label>Card color</label><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div><label>Icon bg</label><input value={form.icon_bg} onChange={(e) => setForm({ ...form, icon_bg: e.target.value })} /></div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn">{editId ? 'Save' : 'Create'}</button>
          {editId && <button type="button" className="btn gray" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      <div>
        <div className="section-head"><h2>Categories ({topLevel.length} top-level · {items.length} total)</h2></div>
        <table>
          <thead><tr><th>Icon</th><th>Name</th><th>Type</th><th>Slug</th><th>Order</th><th></th></tr></thead>
          <tbody>
            {ordered.map((c) => {
              const isSub = c.parent_id != null;
              return (
                <tr key={c.id}>
                  <td style={{ fontSize: 22 }}>{c.icon}</td>
                  <td style={isSub ? { paddingLeft: 28 } : { fontWeight: 600 }}>
                    {isSub && <span className="muted">↳ </span>}{c.name}
                  </td>
                  <td>
                    {isSub
                      ? <span className="tag gray">sub of {c.parent_name}</span>
                      : <span className="tag green">Category</span>}
                  </td>
                  <td className="muted">{c.slug}</td>
                  <td>{c.sort_order}</td>
                  <td className="actions">
                    <button className="btn ghost sm" onClick={() => edit(c)}>Edit</button>
                    <button className="btn gray sm" onClick={() => remove(c.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6} className="muted">No categories yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

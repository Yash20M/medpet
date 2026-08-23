import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';
import { AdminContent, HealthTip, TipSection } from '../types';

type ContentTab = 'tips' | 'brands' | 'reviews' | 'stores' | 'settings';

const TABS: { key: ContentTab; label: string }[] = [
  { key: 'tips', label: 'Health Tips' },
  { key: 'brands', label: 'Brands' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'stores', label: 'Stores' },
  { key: 'settings', label: 'Settings' },
];

const EMPTY_TIP = { title: '', teaser: '', icon: 'sunny', color_from: '#FCD34D', color_to: '#F59E0B', read_mins: 3, sort_order: 0 };
const EMPTY_BRAND = { name: '', emoji: '🐾', tint: '#D1FAE5', sort_order: 0 };
const EMPTY_REVIEW = { owner_name: '', pet_name: '', pet_emoji: '🐕', rating: 5, body: '', sort_order: 0 };
const EMPTY_STORE = { name: '', area: '', distance_km: 1.0, eta_mins: 20, is_open: true, sort_order: 0 };

/** Toggle pill for is_active / is_open flags. */
function Toggle({ on, onClick, labels = ['Active', 'Hidden'] }: { on: boolean; onClick: () => void; labels?: [string, string] | string[] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{
        background: on ? 'var(--primary-soft)' : '#FEE2E2',
        color: on ? 'var(--primary-dark)' : '#B91C1C',
      }}
    >
      {on ? labels[0] : labels[1]}
    </button>
  );
}

export default function AppContent() {
  const [tab, setTab] = useState<ContentTab>('tips');
  const [content, setContent] = useState<AdminContent | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.content().then(setContent).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const fail = (e: unknown) => setErr((e as Error).message);

  // ─── Tips state ────────────────────────────────────────────
  const [tipForm, setTipForm] = useState<typeof EMPTY_TIP>(EMPTY_TIP);
  const [tipSections, setTipSections] = useState<TipSection[]>([{ heading: '', body: '' }]);
  const [tipEditId, setTipEditId] = useState<number | null>(null);

  const submitTip = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const body = {
      ...tipForm,
      read_mins: Number(tipForm.read_mins), sort_order: Number(tipForm.sort_order),
      sections: tipSections.filter((s) => s.heading.trim() && s.body.trim()),
    };
    try {
      if (tipEditId) { await api.updateTip(tipEditId, body); toast('Tip updated'); }
      else { await api.createTip(body); toast('Tip created'); }
      setTipForm(EMPTY_TIP); setTipSections([{ heading: '', body: '' }]); setTipEditId(null); load();
    } catch (e2) { fail(e2); }
  };

  const editTip = (t: HealthTip) => {
    setTipEditId(t.id);
    setTipForm({ title: t.title, teaser: t.teaser, icon: t.icon, color_from: t.color_from, color_to: t.color_to, read_mins: t.read_mins, sort_order: t.sort_order });
    setTipSections(t.sections.length ? t.sections : [{ heading: '', body: '' }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Brands state ──────────────────────────────────────────
  const [brandForm, setBrandForm] = useState<typeof EMPTY_BRAND>(EMPTY_BRAND);
  const [brandEditId, setBrandEditId] = useState<number | null>(null);

  const submitBrand = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const body = { ...brandForm, sort_order: Number(brandForm.sort_order) };
    try {
      if (brandEditId) { await api.updateBrand(brandEditId, body); toast('Brand updated'); }
      else { await api.createBrand(body); toast('Brand created'); }
      setBrandForm(EMPTY_BRAND); setBrandEditId(null); load();
    } catch (e2) { fail(e2); }
  };

  // ─── Reviews state ─────────────────────────────────────────
  const [reviewForm, setReviewForm] = useState<typeof EMPTY_REVIEW>(EMPTY_REVIEW);
  const [reviewEditId, setReviewEditId] = useState<number | null>(null);

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const body = { ...reviewForm, rating: Number(reviewForm.rating), sort_order: Number(reviewForm.sort_order) };
    try {
      if (reviewEditId) { await api.updateTestimonial(reviewEditId, body); toast('Review updated'); }
      else { await api.createTestimonial(body); toast('Review created'); }
      setReviewForm(EMPTY_REVIEW); setReviewEditId(null); load();
    } catch (e2) { fail(e2); }
  };

  // ─── Stores state ──────────────────────────────────────────
  const [storeForm, setStoreForm] = useState<typeof EMPTY_STORE>(EMPTY_STORE);
  const [storeEditId, setStoreEditId] = useState<number | null>(null);

  const submitStore = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const body = { ...storeForm, distance_km: Number(storeForm.distance_km), eta_mins: Number(storeForm.eta_mins), sort_order: Number(storeForm.sort_order) };
    try {
      if (storeEditId) { await api.updateStore(storeEditId, body); toast('Store updated'); }
      else { await api.createStore(body); toast('Store created'); }
      setStoreForm(EMPTY_STORE); setStoreEditId(null); load();
    } catch (e2) { fail(e2); }
  };

  // ─── Settings state ────────────────────────────────────────
  const [etaMins, setEtaMins] = useState('');
  const [flashEndsAt, setFlashEndsAt] = useState('');

  useEffect(() => {
    if (!content) return;
    setEtaMins(content.settings.delivery_eta_minutes ?? '18');
    // ISO → the datetime-local input format (YYYY-MM-DDTHH:mm).
    const iso = content.settings.flash_sale_ends_at ?? '';
    setFlashEndsAt(iso ? iso.slice(0, 16) : '');
  }, [content]);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await api.updateAppSettings({
        delivery_eta_minutes: etaMins,
        flash_sale_ends_at: flashEndsAt ? new Date(flashEndsAt).toISOString() : '',
      });
      toast('Settings saved'); load();
    } catch (e2) { fail(e2); }
  };

  if (!content) return <p className="muted">{err || 'Loading…'}</p>;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setErr(''); }}
            className="px-4 py-2 rounded-full text-sm font-bold transition"
            style={tab === t.key
              ? { background: 'var(--primary)', color: '#fff' }
              : { background: '#fff', color: 'var(--gray)', border: '1px solid var(--border)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="error" style={{ marginBottom: 14 }}>{err}</div>}

      {/* ─── Health Tips ─────────────────────────────────── */}
      {tab === 'tips' && (
        <div className="panel">
          <form className="card" onSubmit={submitTip}>
            <h2>{tipEditId ? 'Edit tip' : 'Add health tip'}</h2>
            <label>Title</label>
            <input value={tipForm.title} onChange={(e) => setTipForm({ ...tipForm, title: e.target.value })} required />
            <label>Teaser</label>
            <textarea rows={2} value={tipForm.teaser} onChange={(e) => setTipForm({ ...tipForm, teaser: e.target.value })} />
            <div className="row">
              <div><label>Icon (Ionicons name)</label><input value={tipForm.icon} onChange={(e) => setTipForm({ ...tipForm, icon: e.target.value })} placeholder="sunny, nutrition, shield-checkmark…" /></div>
              <div><label>Read mins</label><input type="number" min={1} value={tipForm.read_mins} onChange={(e) => setTipForm({ ...tipForm, read_mins: Number(e.target.value) })} /></div>
              <div><label>Order</label><input type="number" value={tipForm.sort_order} onChange={(e) => setTipForm({ ...tipForm, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="row">
              <div><label>Gradient from</label><input value={tipForm.color_from} onChange={(e) => setTipForm({ ...tipForm, color_from: e.target.value })} /></div>
              <div><label>Gradient to</label><input value={tipForm.color_to} onChange={(e) => setTipForm({ ...tipForm, color_to: e.target.value })} /></div>
            </div>

            <label style={{ marginTop: 12 }}>Article sections</label>
            {tipSections.map((s, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <input
                  placeholder={`Section ${i + 1} heading`}
                  value={s.heading}
                  onChange={(e) => setTipSections(tipSections.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))}
                />
                <textarea
                  rows={2}
                  placeholder="Section body"
                  style={{ marginTop: 6 }}
                  value={s.body}
                  onChange={(e) => setTipSections(tipSections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                />
                {tipSections.length > 1 && (
                  <button type="button" className="btn sm gray" style={{ marginTop: 6 }}
                    onClick={() => setTipSections(tipSections.filter((_, j) => j !== i))}>
                    Remove section
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn sm gray" onClick={() => setTipSections([...tipSections, { heading: '', body: '' }])}>
              + Add section
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn">{tipEditId ? 'Save' : 'Create'}</button>
              {tipEditId && <button type="button" className="btn gray" onClick={() => { setTipEditId(null); setTipForm(EMPTY_TIP); setTipSections([{ heading: '', body: '' }]); }}>Cancel</button>}
            </div>
          </form>

          <div>
            <div className="section-head"><h2>Health tips ({content.tips.length})</h2></div>
            <div style={{ display: 'grid', gap: 12 }}>
              {content.tips.map((t) => (
                <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${t.color_from}, ${t.color_to})`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{t.title}</div>
                    <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.teaser} · {t.sections.length} sections · {t.read_mins} min
                    </div>
                  </div>
                  <Toggle on={t.is_active} onClick={async () => { await api.updateTip(t.id, { is_active: !t.is_active }); load(); }} />
                  <div className="actions">
                    <button className="btn sm" onClick={() => editTip(t)}>Edit</button>
                    <button className="btn sm danger" onClick={async () => { if (confirm('Delete this tip?')) { await api.deleteTip(t.id); toast('Deleted'); load(); } }}>Delete</button>
                  </div>
                </div>
              ))}
              {content.tips.length === 0 && <p className="muted">No tips yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Brands ──────────────────────────────────────── */}
      {tab === 'brands' && (
        <div className="panel">
          <form className="card" onSubmit={submitBrand}>
            <h2>{brandEditId ? 'Edit brand' : 'Add brand'}</h2>
            <label>Name</label>
            <input value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} required />
            <div className="row">
              <div><label>Emoji</label><input value={brandForm.emoji} onChange={(e) => setBrandForm({ ...brandForm, emoji: e.target.value })} /></div>
              <div><label>Tint (hex)</label><input value={brandForm.tint} onChange={(e) => setBrandForm({ ...brandForm, tint: e.target.value })} /></div>
              <div><label>Order</label><input type="number" value={brandForm.sort_order} onChange={(e) => setBrandForm({ ...brandForm, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn">{brandEditId ? 'Save' : 'Create'}</button>
              {brandEditId && <button type="button" className="btn gray" onClick={() => { setBrandEditId(null); setBrandForm(EMPTY_BRAND); }}>Cancel</button>}
            </div>
          </form>

          <div>
            <div className="section-head"><h2>Brands ({content.brands.length})</h2></div>
            <div style={{ display: 'grid', gap: 10 }}>
              {content.brands.map((b) => (
                <div key={b.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: b.tint, display: 'grid', placeItems: 'center', fontSize: 20 }}>{b.emoji}</div>
                  <div style={{ flex: 1, fontWeight: 800 }}>{b.name}</div>
                  <Toggle on={b.is_active} onClick={async () => { await api.updateBrand(b.id, { is_active: !b.is_active }); load(); }} />
                  <div className="actions">
                    <button className="btn sm" onClick={() => { setBrandEditId(b.id); setBrandForm({ name: b.name, emoji: b.emoji, tint: b.tint, sort_order: b.sort_order }); }}>Edit</button>
                    <button className="btn sm danger" onClick={async () => { if (confirm('Delete this brand?')) { await api.deleteBrand(b.id); toast('Deleted'); load(); } }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Reviews ─────────────────────────────────────── */}
      {tab === 'reviews' && (
        <div className="panel">
          <form className="card" onSubmit={submitReview}>
            <h2>{reviewEditId ? 'Edit review' : 'Add review'}</h2>
            <div className="row">
              <div><label>Owner name</label><input value={reviewForm.owner_name} onChange={(e) => setReviewForm({ ...reviewForm, owner_name: e.target.value })} required /></div>
              <div><label>Pet name</label><input value={reviewForm.pet_name} onChange={(e) => setReviewForm({ ...reviewForm, pet_name: e.target.value })} /></div>
            </div>
            <div className="row">
              <div><label>Pet emoji</label><input value={reviewForm.pet_emoji} onChange={(e) => setReviewForm({ ...reviewForm, pet_emoji: e.target.value })} /></div>
              <div><label>Rating (1–5)</label><input type="number" min={1} max={5} value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} /></div>
              <div><label>Order</label><input type="number" value={reviewForm.sort_order} onChange={(e) => setReviewForm({ ...reviewForm, sort_order: Number(e.target.value) })} /></div>
            </div>
            <label>Review text</label>
            <textarea rows={3} value={reviewForm.body} onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })} required />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn">{reviewEditId ? 'Save' : 'Create'}</button>
              {reviewEditId && <button type="button" className="btn gray" onClick={() => { setReviewEditId(null); setReviewForm(EMPTY_REVIEW); }}>Cancel</button>}
            </div>
          </form>

          <div>
            <div className="section-head"><h2>Reviews ({content.testimonials.length})</h2></div>
            <div style={{ display: 'grid', gap: 10 }}>
              {content.testimonials.map((r) => (
                <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 26 }}>{r.pet_emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{r.owner_name} {r.pet_name && <span className="muted" style={{ fontWeight: 500 }}>with {r.pet_name}</span>} · {'★'.repeat(r.rating)}</div>
                    <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.body}</div>
                  </div>
                  <Toggle on={r.is_active} onClick={async () => { await api.updateTestimonial(r.id, { is_active: !r.is_active }); load(); }} />
                  <div className="actions">
                    <button className="btn sm" onClick={() => { setReviewEditId(r.id); setReviewForm({ owner_name: r.owner_name, pet_name: r.pet_name, pet_emoji: r.pet_emoji, rating: r.rating, body: r.body, sort_order: r.sort_order }); }}>Edit</button>
                    <button className="btn sm danger" onClick={async () => { if (confirm('Delete this review?')) { await api.deleteTestimonial(r.id); toast('Deleted'); load(); } }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stores ──────────────────────────────────────── */}
      {tab === 'stores' && (
        <div className="panel">
          <form className="card" onSubmit={submitStore}>
            <h2>{storeEditId ? 'Edit store' : 'Add store'}</h2>
            <label>Name</label>
            <input value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} required />
            <label>Area</label>
            <input value={storeForm.area} onChange={(e) => setStoreForm({ ...storeForm, area: e.target.value })} />
            <div className="row">
              <div><label>Distance (km)</label><input type="number" step="0.1" min={0} value={storeForm.distance_km} onChange={(e) => setStoreForm({ ...storeForm, distance_km: Number(e.target.value) })} /></div>
              <div><label>ETA (mins)</label><input type="number" min={1} value={storeForm.eta_mins} onChange={(e) => setStoreForm({ ...storeForm, eta_mins: Number(e.target.value) })} /></div>
              <div><label>Order</label><input type="number" value={storeForm.sort_order} onChange={(e) => setStoreForm({ ...storeForm, sort_order: Number(e.target.value) })} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <input type="checkbox" checked={storeForm.is_open} onChange={(e) => setStoreForm({ ...storeForm, is_open: e.target.checked })} style={{ width: 'auto' }} />
              Currently open
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn">{storeEditId ? 'Save' : 'Create'}</button>
              {storeEditId && <button type="button" className="btn gray" onClick={() => { setStoreEditId(null); setStoreForm(EMPTY_STORE); }}>Cancel</button>}
            </div>
          </form>

          <div>
            <div className="section-head"><h2>Stores ({content.stores.length})</h2></div>
            <div style={{ display: 'grid', gap: 10 }}>
              {content.stores.map((s) => (
                <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{s.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{s.area} · {s.distance_km} km · ~{s.eta_mins} min</div>
                  </div>
                  <Toggle on={s.is_open} labels={['Open', 'Closed']} onClick={async () => { await api.updateStore(s.id, { is_open: !s.is_open }); load(); }} />
                  <Toggle on={s.is_active} onClick={async () => { await api.updateStore(s.id, { is_active: !s.is_active }); load(); }} />
                  <div className="actions">
                    <button className="btn sm" onClick={() => { setStoreEditId(s.id); setStoreForm({ name: s.name, area: s.area, distance_km: Number(s.distance_km), eta_mins: s.eta_mins, is_open: s.is_open, sort_order: s.sort_order }); }}>Edit</button>
                    <button className="btn sm danger" onClick={async () => { if (confirm('Delete this store?')) { await api.deleteStore(s.id); toast('Deleted'); load(); } }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Settings ────────────────────────────────────── */}
      {tab === 'settings' && (
        <form className="card" style={{ maxWidth: 520 }} onSubmit={saveSettings}>
          <h2>App settings</h2>
          <label>Delivery ETA shown on Home (minutes)</label>
          <input type="number" min={1} value={etaMins} onChange={(e) => setEtaMins(e.target.value)} />
          <label>Flash sale ends at (blank = rolling 6-hour window)</label>
          <input type="datetime-local" value={flashEndsAt} onChange={(e) => setFlashEndsAt(e.target.value)} />
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Products appear in the Flash Sale section when their “Flash sale” checkbox is ticked on the Products page.
          </p>
          <button className="btn" style={{ marginTop: 12 }}>Save settings</button>
        </form>
      )}

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

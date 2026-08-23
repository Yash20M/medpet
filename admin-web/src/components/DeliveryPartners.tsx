import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';
import { DeliveryPartner, CreateDeliveryPartnerResult } from '../types';

const EMPTY = { name: '', email: '', phone: '' };

export default function DeliveryPartners() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  // When SMTP isn't configured the backend returns the invite link so it can be
  // shared manually. We surface it here until the admin dismisses it.
  const [invite, setInvite] = useState<{ email: string; url: string } | null>(null);

  const load = () => api.deliveryPartners().then(setPartners).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2800); };

  const handleResult = (r: CreateDeliveryPartnerResult, whenSent: string) => {
    if (r.emailDelivered) {
      toast(whenSent);
      setInvite(null);
    } else if (r.inviteUrl) {
      // Email not sent (dev / no SMTP) — show the link to copy & share.
      setInvite({ email: r.partner.email, url: r.inviteUrl });
    }
    load();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const r = await api.createDeliveryPartner({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      setForm(EMPTY);
      handleResult(r, 'Delivery partner invited — email sent.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resend = async (p: DeliveryPartner) => {
    setErr('');
    try {
      const r = await api.resendDeliveryInvite(p.id);
      handleResult(r, `Invite re-sent to ${p.email}.`);
    } catch (e) { setErr((e as Error).message); }
  };

  const toggleActive = async (p: DeliveryPartner) => {
    setErr('');
    try {
      await api.setDeliveryPartnerActive(p.id, !p.is_active);
      toast(p.is_active ? 'Partner deactivated' : 'Partner activated');
      load();
    } catch (e) { setErr((e as Error).message); }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast('Link copied to clipboard'));
  };

  return (
    <div className="panel">
      <form className="card" onSubmit={submit}>
        <h2>Add delivery partner</h2>
        {err && <div className="error">{err}</div>}
        <label>Full name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ravi Kumar" required />
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rider@example.com" required />
        <label>Phone (optional)</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
        <button className="btn" style={{ marginTop: 16, width: '100%' }} disabled={saving}>
          {saving ? 'Inviting…' : 'Invite partner'}
        </button>
        <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
          The partner receives an email with a link to set their password. Once set, they
          sign in on the MedPet app and the app opens their delivery dashboard automatically.
        </p>

        {invite && (
          <div style={{
            marginTop: 16, background: '#FFF7ED', border: '1px solid #FED7AA',
            borderRadius: 12, padding: 14,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#9A3412' }}>
              ✉️ Email delivery isn't configured
            </div>
            <p className="muted" style={{ margin: '6px 0 8px' }}>
              Share this set-password link with <b>{invite.email}</b> directly:
            </p>
            <div style={{
              fontSize: 12, wordBreak: 'break-all', background: '#fff',
              border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
            }}>{invite.url}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn sm" onClick={() => copy(invite.url)}>Copy link</button>
              <button type="button" className="btn sm gray" onClick={() => setInvite(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </form>

      <div>
        <div className="section-head"><h2>Delivery partners ({partners.length})</h2></div>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Phone</th><th>Account</th>
              <th>Active</th><th>Done</th><th></th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="muted">{p.email}</td>
                <td className="muted">{p.phone ?? '—'}</td>
                <td>
                  {!p.is_active
                    ? <span className="tag red">Deactivated</span>
                    : p.invite_pending
                      ? <span className="tag gray">Invite pending</span>
                      : <span className="tag green">Active</span>}
                </td>
                <td>{p.active_deliveries}</td>
                <td className="muted">{p.completed_deliveries}</td>
                <td>
                  <div className="actions">
                    <button className="btn sm gray" onClick={() => resend(p)}>
                      {p.invite_pending ? 'Resend invite' : 'Reset link'}
                    </button>
                    <button className="btn sm" onClick={() => toggleActive(p)}>
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr><td colSpan={7} className="muted">No delivery partners yet. Add one on the left.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

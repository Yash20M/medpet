import { useEffect, useState, useRef, FormEvent } from 'react';
import { Send } from 'lucide-react';
import { api } from '../api';
import { AdminSupportTicket, AdminSupportTicketDetail, SupportMessage, SupportTicketStatus } from '../types';

const STATUS_TAG: Record<SupportTicketStatus, string> = {
  open: 'red', pending: 'gray', resolved: 'green', closed: 'gray',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Props {
  ticketId: number;
  fallback: AdminSupportTicket;
  incomingMessage: SupportMessage | null;
  onBack: () => void;
  onStatusChanged: (ticketId: number, status: SupportTicketStatus) => void;
}

export default function SupportTicketChat({ ticketId, fallback, incomingMessage, onBack, onStatusChanged }: Props) {
  const [data, setData] = useState<AdminSupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.supportTicket(ticketId)
      .then((d) => { setData(d); setMessages(d.messages); })
      .catch((e) => setErr(e.message));
    api.markTicketRead(ticketId).catch(() => {});
  }, [ticketId]);

  // Append a live message pushed in for this ticket while the chat is open.
  useEffect(() => {
    if (!incomingMessage) return;
    if (incomingMessage.ticket_id !== ticketId) return;
    setMessages((prev) => (prev.some((m) => m.id === incomingMessage.id) ? prev : [...prev, incomingMessage]));
    api.markTicketRead(ticketId).catch(() => {});
  }, [incomingMessage, ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ticket = data ?? fallback;

  const changeStatus = async (status: SupportTicketStatus) => {
    try {
      await api.updateTicketStatus(ticketId, status);
      onStatusChanged(ticketId, status);
      setData((prev) => (prev ? { ...prev, status } : prev));
    } catch (e) { setErr((e as Error).message); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setErr('');
    try {
      const message = await api.sendSupportMessage(ticketId, reply.trim());
      setMessages((prev) => [...prev, message]);
      setReply('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="section-head">
        <button className="btn ghost" onClick={onBack}>← Back to support</button>
        <select
          style={{ width: 150 }}
          value={ticket.status}
          onChange={(e) => changeStatus(e.target.value as SupportTicketStatus)}
        >
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {err && <div className="error">{err}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="od-id">{ticket.subject}</div>
        <div className="muted" style={{ marginTop: 4 }}>
          {ticket.user_name} ({ticket.user_email}) · <span className={`tag ${STATUS_TAG[ticket.status]}`}>{ticket.status}</span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflowY: 'auto' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_role === 'admin' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '72%', padding: '10px 14px', borderRadius: 14, fontSize: 14,
                background: m.sender_role === 'admin' ? 'var(--primary)' : '#EEF0F6',
                color: m.sender_role === 'admin' ? '#fff' : 'var(--ink)',
              }}
            >
              <div>{m.body}</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.75 }}>{fmtTime(m.created_at)}</div>
            </div>
          </div>
        ))}
        {messages.length === 0 && <span className="muted">No messages yet.</span>}
        <div ref={bottomRef} />
      </div>

      <form className="card" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-end' }} onSubmit={submit}>
        <div style={{ flex: 1 }}>
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          />
        </div>
        <button className="btn" disabled={sending || !reply.trim()}>
          <span className="inline-flex items-center gap-1.5"><Send size={15} /> Send</span>
        </button>
      </form>
    </div>
  );
}

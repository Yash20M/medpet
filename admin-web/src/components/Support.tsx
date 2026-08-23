import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { AdminSupportTicket, SupportTicketStatus, SupportMessage } from '../types';
import SupportTicketChat from './SupportTicketChat';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

const STATUSES: SupportTicketStatus[] = ['open', 'pending', 'resolved', 'closed'];
const STATUS_TAG: Record<SupportTicketStatus, string> = {
  open: 'red', pending: 'gray', resolved: 'green', closed: 'gray',
};

interface SsePayload {
  message: SupportMessage;
  ticket: { id: number; subject: string; status: SupportTicketStatus; user_id: number; user_name?: string; user_email?: string };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Support() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [filter, setFilter] = useState<SupportTicketStatus | ''>('');
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<SupportMessage | null>(null);
  const [err, setErr] = useState('');
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const load = () => api.supportTickets(filter || undefined).then(setTickets).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [filter]);

  // One long-lived connection for the whole session — independent of the status filter.
  useEffect(() => {
    const es = new EventSource(api.supportAdminStreamUrl());
    es.addEventListener('support_message', (event: MessageEvent) => {
      if (!event.data) return;
      let payload: SsePayload;
      try { payload = JSON.parse(event.data) as SsePayload; } catch { return; }

      setIncomingMessage(payload.message);
      setTickets((prev) => {
        const activeFilter = filterRef.current;
        const matchesFilter = !activeFilter || payload.ticket.status === activeFilter;
        const idx = prev.findIndex((t) => t.id === payload.ticket.id);

        if (idx === -1) {
          if (!matchesFilter) return prev;
          const row: AdminSupportTicket = {
            id: payload.ticket.id, user_id: payload.ticket.user_id,
            user_name: payload.ticket.user_name ?? '', user_email: payload.ticket.user_email ?? '',
            subject: payload.ticket.subject, status: payload.ticket.status,
            last_message: payload.message.body, last_message_at: payload.message.created_at,
            unread_count: 1, created_at: payload.message.created_at, updated_at: payload.message.created_at,
          };
          return [row, ...prev];
        }

        if (!matchesFilter) return prev.filter((_, i) => i !== idx);

        const updated: AdminSupportTicket = {
          ...prev[idx],
          status: payload.ticket.status,
          last_message: payload.message.body,
          last_message_at: payload.message.created_at,
          unread_count: prev[idx].unread_count + 1,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    });
    return () => es.close();
  }, []);

  const onStatusChanged = (ticketId: number, status: SupportTicketStatus) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
  };

  const { page, setPage, totalPages, total, pageItems, pageSize } = usePagination(tickets, 10);

  const viewing = viewingId != null ? tickets.find((t) => t.id === viewingId) ?? null : null;
  if (viewing) {
    return (
      <SupportTicketChat
        ticketId={viewing.id}
        fallback={viewing}
        incomingMessage={incomingMessage}
        onBack={() => setViewingId(null)}
        onStatusChanged={onStatusChanged}
      />
    );
  }

  return (
    <div>
      <div className="section-head">
        <h2>Support tickets ({tickets.length})</h2>
        <select style={{ width: 180 }} value={filter} onChange={(e) => setFilter(e.target.value as SupportTicketStatus | '')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {err && <div className="error">{err}</div>}

      <table>
        <thead><tr><th>Subject</th><th>Customer</th><th>Last message</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          {pageItems.map((t) => (
            <tr key={t.id}>
              <td>
                {t.subject}
                {t.unread_count > 0 && <span className="tag red" style={{ marginLeft: 6 }}>{t.unread_count} new</span>}
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{t.user_name}</div>
                <div className="muted">{t.user_email}</div>
              </td>
              <td className="muted" style={{ maxWidth: 260 }}>{t.last_message ?? '—'}</td>
              <td><span className={`tag ${STATUS_TAG[t.status]}`}>{t.status}</span></td>
              <td className="muted">{t.last_message_at ? fmtTime(t.last_message_at) : '—'}</td>
              <td><button className="btn sm" onClick={() => setViewingId(t.id)}>Open</button></td>
            </tr>
          ))}
          {tickets.length === 0 && <tr><td colSpan={6} className="muted">No support tickets.</td></tr>}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

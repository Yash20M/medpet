import db from '../../shared/config/database';
import { sseHub } from '../../shared/events/sse';
import {
  SupportTicketRow, SupportMessageRow, SupportTicketSummary, AdminSupportTicketSummary,
  SupportTicketDetail, AdminSupportTicketDetail, TicketStatus, CreateTicketDto,
} from './support.types';

const fail = (message: string, statusCode: number): never => {
  throw Object.assign(new Error(message), { statusCode });
};

const userTicketSelect = (whereExtra: string) => `
  SELECT t.*, lm.body AS last_message, lm.created_at AS last_message_at,
         COALESCE(uc.unread, 0)::int AS unread_count
  FROM support_tickets t
  LEFT JOIN LATERAL (
    SELECT body, created_at FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN (
    SELECT ticket_id, COUNT(*) AS unread FROM support_messages
    WHERE sender_role = 'admin' AND is_read = false GROUP BY ticket_id
  ) uc ON uc.ticket_id = t.id
  ${whereExtra}
  ORDER BY lm.created_at DESC NULLS LAST, t.created_at DESC
`;

const adminTicketSelect = (whereExtra: string) => `
  SELECT t.*, u.name AS user_name, u.email AS user_email,
         lm.body AS last_message, lm.created_at AS last_message_at,
         COALESCE(uc.unread, 0)::int AS unread_count
  FROM support_tickets t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT body, created_at FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN (
    SELECT ticket_id, COUNT(*) AS unread FROM support_messages
    WHERE sender_role = 'user' AND is_read = false GROUP BY ticket_id
  ) uc ON uc.ticket_id = t.id
  ${whereExtra}
  ORDER BY lm.created_at DESC NULLS LAST, t.created_at DESC
`;

const notifyAdmins = (message: SupportMessageRow, ticket: SupportTicketRow, userName?: string, userEmail?: string): void => {
  sseHub.sendToAdmins('support_message', {
    message,
    ticket: {
      id: ticket.id, subject: ticket.subject, status: ticket.status,
      user_id: ticket.user_id, user_name: userName, user_email: userEmail,
    },
  });
};

const notifyCustomer = (message: SupportMessageRow, ticket: SupportTicketRow): void => {
  sseHub.send(ticket.user_id, 'support_message', {
    message,
    ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status, user_id: ticket.user_id },
  });
};

export const SupportService = {
  // ─── Customer ──────────────────────────────────────────────────────────
  async listTicketsForUser(userId: number): Promise<SupportTicketSummary[]> {
    const { rows } = await db.query<SupportTicketSummary>(
      userTicketSelect('WHERE t.user_id = $1'), [userId]
    );
    return rows;
  },

  async getTicketForUser(ticketId: number, userId: number): Promise<SupportTicketDetail | null> {
    const { rows } = await db.query<SupportTicketRow>(
      `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`, [ticketId, userId]
    );
    if (!rows[0]) return null;
    const { rows: messages } = await db.query<SupportMessageRow>(
      `SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [ticketId]
    );
    return { ...rows[0], messages };
  },

  async createTicket(userId: number, dto: CreateTicketDto): Promise<{ ticket: SupportTicketRow; message: SupportMessageRow }> {
    const client = await db.getClient();
    let ticket: SupportTicketRow;
    let message: SupportMessageRow;
    try {
      await client.query('BEGIN');
      const { rows: ticketRows } = await client.query<SupportTicketRow>(
        `INSERT INTO support_tickets (user_id, subject, status) VALUES ($1, $2, 'open') RETURNING *`,
        [userId, dto.subject.trim()]
      );
      ticket = ticketRows[0];
      const { rows: msgRows } = await client.query<SupportMessageRow>(
        `INSERT INTO support_messages (ticket_id, sender_role, sender_id, body) VALUES ($1, 'user', $2, $3) RETURNING *`,
        [ticket.id, userId, dto.body.trim()]
      );
      message = msgRows[0];
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows: userRows } = await db.query<{ name: string; email: string }>(
      `SELECT name, email FROM users WHERE id = $1`, [userId]
    );
    notifyAdmins(message, ticket, userRows[0]?.name, userRows[0]?.email);
    return { ticket, message };
  },

  async addMessageAsUser(ticketId: number, userId: number, body: string): Promise<SupportMessageRow> {
    const { rows: ticketRows } = await db.query<SupportTicketRow>(
      `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`, [ticketId, userId]
    );
    if (!ticketRows[0]) fail('Ticket not found.', 404);
    let ticket = ticketRows[0];

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      const { rows } = await db.query<SupportTicketRow>(
        `UPDATE support_tickets SET status = 'open' WHERE id = $1 RETURNING *`, [ticketId]
      );
      ticket = rows[0];
    }

    const { rows: msgRows } = await db.query<SupportMessageRow>(
      `INSERT INTO support_messages (ticket_id, sender_role, sender_id, body) VALUES ($1, 'user', $2, $3) RETURNING *`,
      [ticketId, userId, body.trim()]
    );
    const message = msgRows[0];

    const { rows: userRows } = await db.query<{ name: string; email: string }>(
      `SELECT name, email FROM users WHERE id = $1`, [userId]
    );
    notifyAdmins(message, ticket, userRows[0]?.name, userRows[0]?.email);
    return message;
  },

  async markReadByUser(ticketId: number, userId: number): Promise<boolean> {
    const { rows } = await db.query(`SELECT id FROM support_tickets WHERE id = $1 AND user_id = $2`, [ticketId, userId]);
    if (!rows[0]) return false;
    await db.query(
      `UPDATE support_messages SET is_read = true WHERE ticket_id = $1 AND sender_role = 'admin' AND is_read = false`,
      [ticketId]
    );
    return true;
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async listTicketsForAdmin(status?: TicketStatus): Promise<AdminSupportTicketSummary[]> {
    const { rows } = await db.query<AdminSupportTicketSummary>(
      adminTicketSelect(status ? 'WHERE t.status = $1' : ''),
      status ? [status] : []
    );
    return rows;
  },

  async getTicketForAdmin(ticketId: number): Promise<AdminSupportTicketDetail | null> {
    const { rows } = await db.query<SupportTicketRow & { user_name: string; user_email: string }>(
      `SELECT t.*, u.name AS user_name, u.email AS user_email
       FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
      [ticketId]
    );
    if (!rows[0]) return null;
    const { rows: messages } = await db.query<SupportMessageRow>(
      `SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [ticketId]
    );
    return { ...rows[0], messages };
  },

  async addMessageAsAdmin(ticketId: number, adminId: number, body: string): Promise<SupportMessageRow> {
    const { rows: ticketRows } = await db.query<SupportTicketRow>(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
    if (!ticketRows[0]) fail('Ticket not found.', 404);
    let ticket = ticketRows[0];

    if (ticket.status === 'open') {
      const { rows } = await db.query<SupportTicketRow>(
        `UPDATE support_tickets SET status = 'pending' WHERE id = $1 RETURNING *`, [ticketId]
      );
      ticket = rows[0];
    }

    const { rows: msgRows } = await db.query<SupportMessageRow>(
      `INSERT INTO support_messages (ticket_id, sender_role, sender_id, body) VALUES ($1, 'admin', $2, $3) RETURNING *`,
      [ticketId, adminId, body.trim()]
    );
    const message = msgRows[0];
    notifyCustomer(message, ticket);
    return message;
  },

  async setStatus(ticketId: number, status: TicketStatus): Promise<SupportTicketRow | null> {
    const { rows } = await db.query<SupportTicketRow>(
      `UPDATE support_tickets SET status = $1 WHERE id = $2 RETURNING *`, [status, ticketId]
    );
    return rows[0] ?? null;
  },

  async markReadByAdmin(ticketId: number): Promise<void> {
    await db.query(
      `UPDATE support_messages SET is_read = true WHERE ticket_id = $1 AND sender_role = 'user' AND is_read = false`,
      [ticketId]
    );
  },
};

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import db from '../../shared/config/database';
import { sseHub } from '../../shared/events/sse';
import { SupportService } from './support.service';
import { TicketStatus, CreateTicketDto, CreateMessageDto } from './support.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

/** SSE clients can't set Authorization headers, so also accept ?token=. */
const resolveUserId = (req: Request): number | null => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.split(' ')[1]
    : (req.query.token as string | undefined);
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
    return id;
  } catch {
    return null;
  }
};

export const SupportController = {
  // ─── Customer ────────────────────────────────────────────────────────────
  async listTickets(req: Request, res: Response): Promise<void> {
    const data = await SupportService.listTicketsForUser(req.user!.id);
    sendSuccess(res, { message: 'Tickets fetched.', data });
  },

  async createTicket(req: Request, res: Response): Promise<void> {
    const data = await SupportService.createTicket(req.user!.id, req.body as CreateTicketDto);
    sendSuccess(res, { message: 'Ticket created.', data }, 201);
  },

  async getTicket(req: Request, res: Response): Promise<void> {
    const data = await SupportService.getTicketForUser(Number(req.params.id), req.user!.id);
    if (!data) { sendError(res, 'Ticket not found.', 404); return; }
    sendSuccess(res, { message: 'Ticket fetched.', data });
  },

  async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const data = await SupportService.addMessageAsUser(
        Number(req.params.id), req.user!.id, (req.body as CreateMessageDto).body
      );
      sendSuccess(res, { message: 'Message sent.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async markRead(req: Request, res: Response): Promise<void> {
    const ok = await SupportService.markReadByUser(Number(req.params.id), req.user!.id);
    if (!ok) { sendError(res, 'Ticket not found.', 404); return; }
    sendSuccess(res, { message: 'Marked as read.' });
  },

  // ─── Admin ───────────────────────────────────────────────────────────────
  async adminListTickets(req: Request, res: Response): Promise<void> {
    const data = await SupportService.listTicketsForAdmin(req.query.status as TicketStatus | undefined);
    sendSuccess(res, { message: 'Tickets fetched.', data });
  },

  async adminGetTicket(req: Request, res: Response): Promise<void> {
    const data = await SupportService.getTicketForAdmin(Number(req.params.id));
    if (!data) { sendError(res, 'Ticket not found.', 404); return; }
    sendSuccess(res, { message: 'Ticket fetched.', data });
  },

  async adminAddMessage(req: Request, res: Response): Promise<void> {
    try {
      const data = await SupportService.addMessageAsAdmin(
        Number(req.params.id), req.user!.id, (req.body as CreateMessageDto).body
      );
      sendSuccess(res, { message: 'Reply sent.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async adminSetStatus(req: Request, res: Response): Promise<void> {
    const data = await SupportService.setStatus(Number(req.params.id), req.body.status as TicketStatus);
    if (!data) { sendError(res, 'Ticket not found.', 404); return; }
    sendSuccess(res, { message: 'Status updated.', data });
  },

  async adminMarkRead(req: Request, res: Response): Promise<void> {
    await SupportService.markReadByAdmin(Number(req.params.id));
    sendSuccess(res, { message: 'Marked as read.' });
  },

  /** Role-aware SSE stream for the admin dashboard's live ticket inbox. */
  async adminStream(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    if (!userId) { sendError(res, 'Invalid or missing token.', 401); return; }

    const { rows } = await db.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1 AND is_active = true`, [userId]
    );
    if (rows[0]?.role !== 'admin') { sendError(res, 'Admin access required.', 403); return; }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const client = sseHub.add(userId, res, 'admin');
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseHub.remove(client);
    });
  },
};

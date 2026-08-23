import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './notifications.types';
import { sseHub } from '../../shared/events/sse';
import { sendSuccess, sendError } from '../../shared/utils/response';

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

export const NotificationsController = {
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const [data, unread] = await Promise.all([
      NotificationsService.list(userId),
      NotificationsService.unreadCount(userId),
    ]);
    res.json({ success: true, message: 'Notifications fetched.', data, unread });
  },

  async markRead(req: Request, res: Response): Promise<void> {
    const ok = await NotificationsService.markRead(req.user!.id, Number(req.params.id));
    if (!ok) { sendError(res, 'Notification not found.', 404); return; }
    sendSuccess(res, { message: 'Marked as read.' });
  },

  async markAllRead(req: Request, res: Response): Promise<void> {
    await NotificationsService.markAllRead(req.user!.id);
    sendSuccess(res, { message: 'All marked as read.' });
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await NotificationsService.create(req.body as CreateNotificationDto);
      sendSuccess(res, { message: 'Notification sent.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, 400);
    }
  },

  /** Server-Sent Events stream: keeps the connection open and pushes events. */
  stream(req: Request, res: Response): void {
    const userId = resolveUserId(req);
    if (!userId) { sendError(res, 'Invalid or missing token.', 401); return; }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const client = sseHub.add(userId, res);

    // Heartbeat keeps proxies / RN from dropping the idle connection.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseHub.remove(client);
    });
  },
};

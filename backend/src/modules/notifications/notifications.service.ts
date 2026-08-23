import db from '../../shared/config/database';
import { sseHub } from '../../shared/events/sse';
import { Notification, CreateNotificationDto } from './notifications.types';

const COLS = 'id, user_id, title, body, type, is_read, created_at';

export const NotificationsService = {
  /** Notifications addressed to this user plus global broadcasts (user_id IS NULL). */
  async list(userId: number): Promise<Notification[]> {
    const { rows } = await db.query<Notification>(
      `SELECT ${COLS} FROM notifications
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return rows;
  },

  async unreadCount(userId: number): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
      [userId]
    );
    return Number(rows[0]?.count ?? 0);
  },

  /** Persist a notification and push it over SSE to the recipient(s). */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const { rows } = await db.query<Notification>(
      `INSERT INTO notifications (user_id, title, body, type)
       VALUES ($1, $2, COALESCE($3,''), COALESCE($4,'general'))
       RETURNING ${COLS}`,
      [dto.userId ?? null, dto.title.trim(), dto.body, dto.type]
    );
    const notification = rows[0];
    sseHub.send(notification.user_id, 'notification', notification);
    return notification;
  },

  async markRead(userId: number, id: number): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
      [id, userId]
    );
    return (rowCount ?? 0) > 0;
  },

  async markAllRead(userId: number): Promise<void> {
    await db.query(
      `UPDATE notifications SET is_read = true
       WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
      [userId]
    );
  },
};

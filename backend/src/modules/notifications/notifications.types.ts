export interface Notification {
  id: number;
  user_id: number | null;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: Date;
}

export interface CreateNotificationDto {
  userId?: number | null;   // null/omitted = broadcast to all users
  title: string;
  body?: string;
  type?: string;
}

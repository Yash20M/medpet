export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type SenderRole = 'user' | 'admin';

export interface SupportTicketRow {
  id: number;
  user_id: number;
  subject: string;
  status: TicketStatus;
  created_at: Date;
  updated_at: Date;
}

export interface SupportMessageRow {
  id: number;
  ticket_id: number;
  sender_role: SenderRole;
  sender_id: number;
  body: string;
  is_read: boolean;
  created_at: Date;
}

export interface SupportTicketSummary extends SupportTicketRow {
  last_message: string | null;
  last_message_at: Date | null;
  unread_count: number;
}

export interface AdminSupportTicketSummary extends SupportTicketSummary {
  user_name: string;
  user_email: string;
}

export interface SupportTicketDetail extends SupportTicketRow {
  messages: SupportMessageRow[];
}

export interface AdminSupportTicketDetail extends SupportTicketDetail {
  user_name: string;
  user_email: string;
}

export interface CreateTicketDto {
  subject: string;
  body: string;
}

export interface CreateMessageDto {
  body: string;
}

/** Payload pushed over SSE — denormalized so listeners don't need a follow-up fetch. */
export interface SupportMessageEvent {
  message: SupportMessageRow;
  ticket: {
    id: number;
    subject: string;
    status: TicketStatus;
    user_id: number;
    user_name?: string;
    user_email?: string;
  };
}

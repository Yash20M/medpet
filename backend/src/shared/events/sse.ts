import { Response } from 'express';

export type SseRole = 'customer' | 'admin';

interface SseClient {
  userId: number;
  role: SseRole;
  res: Response;
}

/**
 * Minimal in-memory Server-Sent Events hub.
 * Tracks open connections per user and pushes events to them.
 */
class SseHub {
  private clients = new Set<SseClient>();

  add(userId: number, res: Response, role: SseRole = 'customer'): SseClient {
    const client: SseClient = { userId, role, res };
    this.clients.add(client);
    return client;
  }

  remove(client: SseClient): void {
    this.clients.delete(client);
  }

  /** Send to one user, or to everyone when userId is null (broadcast). */
  send(userId: number | null, event: string, data: unknown): void {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      if (userId === null || client.userId === userId) {
        try {
          client.res.write(frame);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }

  /** Send to every connection registered with the 'admin' role. */
  sendToAdmins(event: string, data: unknown): void {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      if (client.role === 'admin') {
        try {
          client.res.write(frame);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }

  /** Number of currently open connections (for debugging). */
  get size(): number {
    return this.clients.size;
  }
}

export const sseHub = new SseHub();

import type { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service';
import { orderRoom, ADMIN_ALL } from '../../shared/realtime/io';
import { broadcastPing } from './broadcast';

/**
 * Registers all tracking-related socket events for a freshly connected client.
 * `socket.data.userId` / `socket.data.role` are populated by the handshake auth
 * middleware in shared/realtime/socket.ts.
 */
export const registerTrackingSocket = (_io: Server, socket: Socket): void => {
  // ─── Customer opens / leaves a tracking screen ────────────────────────────
  socket.on('customer:subscribe', ({ orderId }: { orderId: number }) => {
    socket.join(orderRoom(orderId));
    socket.emit('subscribed', { orderId, ok: true });
  });

  socket.on('customer:unsubscribe', ({ orderId }: { orderId: number }) => {
    socket.leave(orderRoom(orderId));
  });

  // ─── Admin opens an order view, or the whole live map ─────────────────────
  socket.on('admin:subscribe', (payload: 'all' | { orderId: number | 'all' }) => {
    const wantsAll = payload === 'all' || (typeof payload === 'object' && payload.orderId === 'all');
    if (wantsAll) {
      socket.join(ADMIN_ALL);
      socket.emit('subscribed', { scope: 'all', ok: true });
    } else if (typeof payload === 'object') {
      socket.join(orderRoom(payload.orderId));
      socket.emit('subscribed', { orderId: payload.orderId, ok: true });
    }
  });

  // ─── Driver pushes a GPS ping (every ~3 s) ────────────────────────────────
  socket.on('driver:location-update', async (payload: { orderId: number; lat: number; lng: number; heading?: number; speed?: number; timestamp?: number }) => {
    const driverId: number | null = socket.data.userId ?? null;
    if (!driverId || socket.data.role !== 'delivery') {
      socket.emit('tracking:error', { message: 'Not authorized to send location.' });
      return;
    }

    try {
      const result = await TrackingService.processPing({ ...payload, driverId });
      if (!result.processed) {
        socket.emit('tracking:ack', { processed: false, reason: result.reason });
        return;
      }

      broadcastPing(payload.orderId, result);
      socket.emit('tracking:ack', { processed: true });
    } catch (err) {
      socket.emit('tracking:error', { message: (err as Error).message });
    }
  });
};

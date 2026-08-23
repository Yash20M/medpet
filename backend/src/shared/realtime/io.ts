import type { Server } from 'socket.io';

/**
 * Process-wide Socket.IO singleton + room helpers. Kept dependency-light so REST
 * controllers can broadcast without importing the socket wiring (avoids cycles).
 */
let io: Server | null = null;

export const setIO = (server: Server): void => { io = server; };
export const getIO = (): Server | null => io;

/** One room per order — customer + admin(+driver) join it; driver pings fan out to it. */
export const orderRoom = (orderId: number | string): string => `order:${orderId}`;
/** Firehose room for the admin live map (all active deliveries). */
export const ADMIN_ALL = 'admin:all';

export const emitToOrder = (orderId: number | string, event: string, payload: unknown): void => {
  io?.to(orderRoom(orderId)).emit(event, payload);
};

export const emitToAdmins = (event: string, payload: unknown): void => {
  io?.to(ADMIN_ALL).emit(event, payload);
};

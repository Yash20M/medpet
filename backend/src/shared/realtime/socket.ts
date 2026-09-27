import type http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { corsOrigin } from '../config/corsOrigin';
import { setIO } from './io';
import { registerTrackingSocket } from '../../modules/tracking/tracking.sockets';

/**
 * Attach a Socket.IO server to the given HTTP server. Authenticates the
 * handshake JWT (same secret as REST) and stashes userId/role on socket.data.
 * Unauthenticated sockets are allowed to connect but can only subscribe — the
 * driver location pipeline additionally checks role + order assignment.
 */
export const attachSockets = (server: http.Server): Server => {
  const io = new Server(server, {
    cors: { origin: corsOrigin(), credentials: true },
  });

  io.use(async (socket, next) => {
    socket.data.userId = null;
    socket.data.role = 'guest';
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    if (token) {
      try {
        const { id } = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
        const { rows } = await db.query<{ id: number; role: string; name: string }>(
          `SELECT id, role, name FROM users WHERE id = $1 AND is_active = true`,
          [id]
        );
        if (rows[0]) {
          socket.data.userId = rows[0].id;
          socket.data.role = rows[0].role;
          socket.data.name = rows[0].name;
        }
      } catch {
        /* invalid token → stays a guest */
      }
    }
    next();
  });

  io.on('connection', (socket) => registerTrackingSocket(io, socket));

  setIO(io);
  return io;
};

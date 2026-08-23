import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { SOCKET_URL } from './api';

/**
 * Lazily-created Socket.IO singleton. The auth token is read from SecureStore
 * and sent in the handshake so the server can identify the user/role.
 * Auto-reconnect is on by default (socket.io-client) — the tracking hook shows
 * a "Reconnecting…" indicator and falls back to REST polling while offline.
 */
let socket: Socket | null = null;

export const getSocket = async (): Promise<Socket> => {
  if (socket && socket.connected) return socket;
  if (socket) return socket; // reconnecting — reuse the instance

  const token = (await SecureStore.getItemAsync('authToken')) ?? '';
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    timeout: 8000,
  });
  return socket;
};

/** Close and drop the shared socket (e.g. on logout). */
export const closeSocket = (): void => {
  socket?.close();
  socket = null;
};

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, getToken } from '../api';
import { LocationBroadcast, StatusChange } from '../liveTypes';

interface Handlers {
  onLocation?: (p: LocationBroadcast) => void;
  onStatus?: (p: StatusChange) => void;
  onConnected?: (connected: boolean) => void;
}

/**
 * Admin Socket.IO connection subscribed to the "all" firehose room, so every
 * driver ping across the city lands here in real time.
 */
export const useAdminSocket = ({ onLocation, onStatus, onConnected }: Handlers): void => {
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token: getToken() ?? '' },
      reconnection: true,
    });
    ref.current = socket;

    const subscribe = (): void => { socket.emit('admin:subscribe', 'all'); onConnected?.(true); };
    socket.on('connect', subscribe);
    socket.on('disconnect', () => onConnected?.(false));
    if (onLocation) socket.on('tracking:location', onLocation);
    if (onStatus) socket.on('tracking:status-change', onStatus);
    if (socket.connected) subscribe();

    return () => { socket.close(); ref.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

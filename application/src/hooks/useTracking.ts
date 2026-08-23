import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import {
  trackingAPI, TrackingState, LocationBroadcast, StatusChange, LivePhase, OrderStatus,
} from '../services/api';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

export interface LiveTracking {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  eta: number;
  distanceRemaining: number;
  progress: number;
  phase: LivePhase | null;
  status: OrderStatus;
  timestamp: number;
}

interface UseTracking {
  state: TrackingState | null;
  live: LiveTracking | null;
  connection: ConnectionStatus;
  refresh: () => Promise<void>;
}

const POLL_MS = 5000;
const OFFLINE_GRACE_MS = 10_000;

const liveFromState = (s: TrackingState): LiveTracking | null => {
  const loc = s.driver.location;
  if (!loc) return null;
  return {
    lat: loc.lat, lng: loc.lng, heading: loc.heading, speed: loc.speed,
    eta: s.tracking.etaMinutes ?? s.route?.estimatedMinutes ?? 0,
    distanceRemaining: s.tracking.distanceRemainingKm ?? s.route?.distanceKm ?? 0,
    progress: s.tracking.progress ?? 0,
    phase: s.phase, status: s.status,
    timestamp: loc.updatedAt ? Date.parse(loc.updatedAt) : Date.now(),
  };
};

/**
 * Live order tracking: hydrates from REST, subscribes over Socket.IO, and falls
 * back to REST polling when the socket has been down for >10s.
 */
export const useTracking = (orderId: number): UseTracking => {
  const [state, setState] = useState<TrackingState | null>(null);
  const [live, setLive] = useState<LiveTracking | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');

  const socketRef = useRef<Socket | null>(null);
  const disconnectedSinceRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await trackingAPI.get(orderId);
      if (!mountedRef.current) return;
      setState(res.data);
      setLive((prev) => prev ?? liveFromState(res.data));
    } catch {
      /* backend unreachable — keep last state */
    }
  }, [orderId]);

  // REST polling fallback (started only while the socket is offline).
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      if (disconnectedSinceRef.current && Date.now() - disconnectedSinceRef.current > OFFLINE_GRACE_MS) {
        try {
          const res = await trackingAPI.get(orderId);
          if (!mountedRef.current) return;
          setState(res.data);
          const l = liveFromState(res.data);
          if (l) setLive(l);
        } catch { /* ignore */ }
      }
    }, POLL_MS);
  }, [orderId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let socket: Socket | null = null;

    const onLocation = (p: LocationBroadcast): void => {
      if (p.orderId !== orderId) return;
      setConnection('live');
      setLive({
        lat: p.lat, lng: p.lng, heading: p.heading, speed: p.speed,
        eta: p.eta, distanceRemaining: p.distanceRemaining, progress: p.progress,
        phase: p.phase, status: p.status, timestamp: p.timestamp,
      });
    };
    const onStatus = (p: StatusChange): void => {
      if (p.orderId !== orderId) return;
      setLive((prev) => (prev ? { ...prev, phase: p.newStatus } : prev));
      setState((prev) => (prev ? { ...prev, phase: p.newStatus } : prev));
    };
    const onEta = (p: { orderId: number; etaMinutes: number; distanceRemainingKm: number }): void => {
      if (p.orderId !== orderId) return;
      setLive((prev) => (prev ? { ...prev, eta: p.etaMinutes, distanceRemaining: p.distanceRemainingKm } : prev));
    };
    const onConnect = (): void => {
      disconnectedSinceRef.current = null;
      stopPolling();
      setConnection('live');
      socket?.emit('customer:subscribe', { orderId });
    };
    const onDisconnect = (): void => {
      disconnectedSinceRef.current = Date.now();
      setConnection('reconnecting');
      startPolling();
    };

    (async () => {
      await refresh();
      socket = await getSocket();
      socketRef.current = socket;

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('tracking:location', onLocation);
      socket.on('tracking:status-change', onStatus);
      socket.on('tracking:eta-update', onEta);

      if (socket.connected) onConnect();
      else setConnection('connecting');
    })();

    return () => {
      mountedRef.current = false;
      stopPolling();
      const s = socketRef.current;
      if (s) {
        s.emit('customer:unsubscribe', { orderId });
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        s.off('tracking:location', onLocation);
        s.off('tracking:status-change', onStatus);
        s.off('tracking:eta-update', onEta);
      }
    };
  }, [orderId, refresh, startPolling, stopPolling]);

  return { state, live, connection, refresh };
};

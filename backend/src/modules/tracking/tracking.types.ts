import { LatLng } from '../../shared/config/amravati';

/** Fine-grained live-journey phase, layered on top of the canonical order status. */
export type LivePhase = 'preparing' | 'picked' | 'on_the_way' | 'nearby' | 'delivered';

export const PHASE_ORDER: LivePhase[] = ['preparing', 'picked', 'on_the_way', 'nearby', 'delivered'];

/** Raw GPS ping as sent by the driver app over the socket. */
export interface DriverPing {
  orderId: number;
  driverId: number;   // filled from the authenticated socket, not the payload
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;     // km/h
  timestamp?: number; // epoch ms
}

/** What GET /:id/tracking returns and what the client hydrates from on mount. */
export interface TrackingState {
  orderId: number;
  orderNumber: string;
  status: string;                 // canonical order status
  phase: LivePhase | null;        // live-journey phase (null until dispatched)
  pickup: LatLng | null;
  drop: LatLng | null;
  driver: {
    id: number | null;
    name: string | null;
    phone: string | null;
    vehicleNumber: string | null;
    vehicleType: string | null;
    location: (LatLng & { heading: number; speed: number; updatedAt: string | null }) | null;
  };
  route: {
    polyline: LatLng[];
    distanceKm: number;
    estimatedMinutes: number;
  } | null;
  tracking: {
    startedAt: string | null;
    deliveredAt: string | null;
    lastPingAt: string | null;
    etaMinutes: number | null;
    distanceRemainingKm: number | null;
    progress: number;
  };
}

/** `tracking:location` broadcast payload. */
export interface LocationBroadcast {
  orderId: number;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  eta: number;
  distanceRemaining: number;
  progress: number;
  phase: LivePhase;
  status: string;
  timestamp: number;
}

/** Result of the ping-processing pipeline. */
export interface PingResult {
  processed: boolean;
  reason?: 'debounced' | 'no-route' | 'not-live' | 'out-of-bounds' | 'not-assigned' | 'not-found';
  broadcast?: LocationBroadcast;
  statusChange?: { orderId: number; oldPhase: LivePhase | null; newPhase: LivePhase; timestamp: number };
}

/** One row of the admin "all active drivers" map. */
export interface ActiveDriver {
  orderId: number;
  orderNumber: string;
  status: string;
  phase: LivePhase | null;
  driverId: number | null;
  driverName: string | null;
  customerName: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  etaMinutes: number | null;
  distanceRemainingKm: number | null;
}

export interface DispatchDto {
  driverId?: number;
  pickup?: LatLng;
  drop?: LatLng;
}

/** Delivery analytics for the admin dashboard (Task 4C). */
export interface DeliveryAnalytics {
  avgDeliveryMinutes: number | null;
  deliveredToday: number;
  deliveredTotal: number;
  activeNow: number;
  /** 0–100: how close actual delivery time was to the OSRM estimate. */
  etaAccuracyPct: number | null;
  topDrivers: { driverId: number; name: string; deliveries: number; avgMinutes: number | null }[];
  /** Busiest drop zones — drop points binned to ~0.01° cells. */
  zones: { lat: number; lng: number; count: number }[];
}

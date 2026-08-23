export type LivePhase = 'preparing' | 'picked' | 'on_the_way' | 'nearby' | 'delivered';

export interface LatLng { lat: number; lng: number; }

/** One row of GET /api/drivers/active — a live delivery for the admin map. */
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

/** `tracking:location` socket payload. */
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

export interface StatusChange {
  orderId: number;
  oldStatus: LivePhase | null;
  newStatus: LivePhase;
  timestamp: number;
}

/** Full state from GET /api/orders/:id/tracking. */
export interface AdminTrackingState {
  orderId: number;
  orderNumber: string;
  status: string;
  phase: LivePhase | null;
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
  route: { polyline: LatLng[]; distanceKm: number; estimatedMinutes: number } | null;
  tracking: {
    startedAt: string | null;
    deliveredAt: string | null;
    lastPingAt: string | null;
    etaMinutes: number | null;
    distanceRemainingKm: number | null;
    progress: number;
  };
}

/** Delivery analytics (Task 4C) from GET /api/drivers/analytics. */
export interface DeliveryAnalytics {
  avgDeliveryMinutes: number | null;
  deliveredToday: number;
  deliveredTotal: number;
  activeNow: number;
  etaAccuracyPct: number | null;
  topDrivers: { driverId: number; name: string; deliveries: number; avgMinutes: number | null }[];
  zones: { lat: number; lng: number; count: number }[];
}

// ─── Phase → colour / label (Zomato-style status pills on the map) ──────────
export const PHASE_COLOR: Record<LivePhase, string> = {
  preparing: '#F59E0B',   // amber
  picked: '#0EA5E9',      // sky
  on_the_way: '#8B5CF6',  // purple
  nearby: '#10B981',      // green
  delivered: '#64748B',   // slate
};

export const PHASE_LABEL: Record<LivePhase, string> = {
  preparing: 'Preparing',
  picked: 'Picked up',
  on_the_way: 'On the way',
  nearby: 'Nearby',
  delivered: 'Delivered',
};

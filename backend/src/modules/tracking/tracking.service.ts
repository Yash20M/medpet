import db from '../../shared/config/database';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEmailService } from '../orders/orders.email';
import { OrderStatus } from '../orders/orders.types';
import {
  LatLng, STORE_LOCATION, CITY_SPEED_KMH,
} from '../../shared/config/amravati';
import { fetchRoute, geocodeAddress } from '../../shared/services/routeService';
import { snapToRoute } from '../../shared/services/snapToRoute';
import { etaMinutes } from '../../shared/services/etaCalculator';
import { haversineKm, toTuple, fromTuple, LatLngTuple } from '../../shared/services/geo';
import {
  LivePhase, PHASE_ORDER, DriverPing, TrackingState, PingResult,
  ActiveDriver, DispatchDto, LocationBroadcast, DeliveryAnalytics,
} from './tracking.types';

// pg returns NUMERIC as strings — normalise to number | null.
const toNum = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : (v as string | null) ?? null;

export const orderNumber = (id: number): string => `ORD-${String(id).padStart(4, '0')}`;

const DEBOUNCE_MS = 2000;
// A ping that snaps more than this far from the cached route is treated as bogus GPS.
const MAX_PING_DEVIATION_KM = 3;

/** Row shape used when hydrating a full tracking state. */
interface TrackingRow {
  id: number;
  user_id: number;
  status: string;
  latitude: string | null;
  longitude: string | null;
  delivery_partner_id: number | null;
  pickup_lat: string | null;
  pickup_lng: string | null;
  route_polyline: LatLngTuple[] | null;
  route_distance_km: string | null;
  route_eta_minutes: number | null;
  driver_lat: string | null;
  driver_lng: string | null;
  driver_heading: string | null;
  driver_speed: string | null;
  driver_location_at: Date | null;
  tracking_phase: LivePhase | null;
  tracking_started_at: Date | null;
  tracking_delivered_at: Date | null;
  tracking_last_ping_at: Date | null;
  tracking_eta_minutes: number | null;
  tracking_distance_remaining_km: string | null;
  tracking_progress: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
}

const FULL_SELECT = `
  SELECT o.id, o.user_id, o.status, o.latitude, o.longitude, o.delivery_partner_id,
         o.pickup_lat, o.pickup_lng,
         o.route_polyline, o.route_distance_km, o.route_eta_minutes,
         o.driver_lat, o.driver_lng, o.driver_heading, o.driver_speed, o.driver_location_at,
         o.tracking_phase, o.tracking_started_at, o.tracking_delivered_at, o.tracking_last_ping_at,
         o.tracking_eta_minutes, o.tracking_distance_remaining_km, o.tracking_progress,
         dp.name AS driver_name, dp.phone AS driver_phone,
         dp.vehicle_number, dp.vehicle_type
  FROM orders o
  LEFT JOIN users dp ON dp.id = o.delivery_partner_id
`;

const pointOrNull = (lat: string | null, lng: string | null): LatLng | null => {
  const la = toNum(lat), ln = toNum(lng);
  return la === null || ln === null ? null : { lat: la, lng: ln };
};

const buildState = (r: TrackingRow): TrackingState => {
  const polyTuples = r.route_polyline ?? [];
  const driverLoc = pointOrNull(r.driver_lat, r.driver_lng);
  return {
    orderId: r.id,
    orderNumber: orderNumber(r.id),
    status: r.status,
    phase: r.tracking_phase,
    pickup: pointOrNull(r.pickup_lat, r.pickup_lng),
    drop: pointOrNull(r.latitude, r.longitude),
    driver: {
      id: r.delivery_partner_id,
      name: r.driver_name,
      phone: r.driver_phone,
      vehicleNumber: r.vehicle_number,
      vehicleType: r.vehicle_type,
      location: driverLoc
        ? {
            ...driverLoc,
            heading: toNum(r.driver_heading) ?? 0,
            speed: toNum(r.driver_speed) ?? 0,
            updatedAt: iso(r.driver_location_at),
          }
        : null,
    },
    route: polyTuples.length
      ? {
          polyline: polyTuples.map(fromTuple),
          distanceKm: toNum(r.route_distance_km) ?? 0,
          estimatedMinutes: r.route_eta_minutes ?? 0,
        }
      : null,
    tracking: {
      startedAt: iso(r.tracking_started_at),
      deliveredAt: iso(r.tracking_delivered_at),
      lastPingAt: iso(r.tracking_last_ping_at),
      etaMinutes: r.tracking_eta_minutes,
      distanceRemainingKm: toNum(r.tracking_distance_remaining_km),
      progress: toNum(r.tracking_progress) ?? 0,
    },
  };
};

/**
 * Forward-only phase machine driven by the thresholds in the spec (1C step 4).
 * Caps out at 'nearby' — GPS proximity alone no longer auto-completes a
 * delivery. Reaching the doorstep is a strong hint, not proof of handoff, so
 * the final 'delivered' transition requires the customer's OTP (see
 * DeliveryOtpService / DeliveryService.markDelivered) or an explicit admin
 * override (TrackingController.setPhase, admin-only for this phase).
 */
const computePhase = (
  current: LivePhase | null,
  distToPickupKm: number,
  distToDropKm: number,
  progress: number
): LivePhase => {
  const cur: LivePhase = current ?? 'preparing';
  const rank = (p: LivePhase): number => PHASE_ORDER.indexOf(p);
  let cand: LivePhase = cur;
  const bump = (p: LivePhase): void => { if (rank(p) > rank(cand)) cand = p; };

  if (distToPickupKm < 0.1) bump('picked');                       // <100 m of pickup
  if (progress > 0.05 && distToPickupKm > 0.15) bump('on_the_way'); // moving away from pickup
  if (distToDropKm < 0.5) bump('nearby');                          // <500 m of drop

  return rank(cand) >= rank(cur) ? cand : cur;
};

export const TrackingService = {
  async getTracking(orderId: number): Promise<TrackingState | null> {
    const { rows } = await db.query<TrackingRow>(`${FULL_SELECT} WHERE o.id = $1`, [orderId]);
    return rows[0] ? buildState(rows[0]) : null;
  },

  /** Owner / assigned-driver / admin access check for a tracking view. */
  async canView(orderId: number, userId: number, role: string): Promise<boolean> {
    if (role === 'admin') return true;
    const { rows } = await db.query<{ user_id: number; delivery_partner_id: number | null }>(
      `SELECT user_id, delivery_partner_id FROM orders WHERE id = $1`,
      [orderId]
    );
    const o = rows[0];
    return !!o && (o.user_id === userId || o.delivery_partner_id === userId);
  },

  async getRoute(orderId: number): Promise<{ polyline: LatLng[]; distanceKm: number; estimatedMinutes: number } | null> {
    const { rows } = await db.query<{ route_polyline: LatLngTuple[] | null; route_distance_km: string | null; route_eta_minutes: number | null }>(
      `SELECT route_polyline, route_distance_km, route_eta_minutes FROM orders WHERE id = $1`,
      [orderId]
    );
    const r = rows[0];
    if (!r?.route_polyline?.length) return null;
    return {
      polyline: r.route_polyline.map(fromTuple),
      distanceKm: toNum(r.route_distance_km) ?? 0,
      estimatedMinutes: r.route_eta_minutes ?? 0,
    };
  },

  /**
   * Compute and cache the store→drop route as soon as an order exists — before
   * any rider is assigned — so the customer can see pickup/drop pins and a
   * planned route/ETA while the order is still being packed (Blinkit-style).
   * Deliberately leaves delivery_partner_id/status/tracking_phase untouched;
   * `dispatch()` still owns those once a rider actually accepts.
   */
  async precomputeRoute(orderId: number): Promise<void> {
    const { rows } = await db.query<{ latitude: string | null; longitude: string | null; address: string }>(
      `SELECT latitude, longitude, address FROM orders WHERE id = $1`,
      [orderId]
    );
    const order = rows[0];
    if (!order) return;

    const pickup: LatLng = STORE_LOCATION;
    let drop: LatLng | null = pointOrNull(order.latitude, order.longitude);
    if (!drop) drop = (await geocodeAddress(order.address)) ?? { ...STORE_LOCATION };

    const route = await fetchRoute(pickup, drop);
    const tuples = route.polyline.map(toTuple);

    await db.query(
      `UPDATE orders SET
         pickup_lat        = $2,
         pickup_lng        = $3,
         latitude          = COALESCE(latitude, $4),
         longitude         = COALESCE(longitude, $5),
         route_polyline    = $6::jsonb,
         route_distance_km = $7,
         route_eta_minutes = $8
       WHERE id = $1`,
      [orderId, pickup.lat, pickup.lng, drop.lat, drop.lng, JSON.stringify(tuples), route.distanceKm, route.estimatedMinutes]
    );
  },

  /**
   * Assign a driver, resolve pickup/drop, fetch the OSRM route ONCE and cache it.
   * Idempotent-ish: re-dispatching refreshes the route without resetting progress.
   */
  async dispatch(orderId: number, dto: DispatchDto): Promise<TrackingState> {
    const { rows } = await db.query<{ status: string; latitude: string | null; longitude: string | null; address: string; delivery_partner_id: number | null }>(
      `SELECT status, latitude, longitude, address, delivery_partner_id FROM orders WHERE id = $1`,
      [orderId]
    );
    const order = rows[0];
    if (!order) throw Object.assign(new Error('Order not found.'), { statusCode: 404 });

    const pickup: LatLng = dto.pickup ?? STORE_LOCATION;
    let drop: LatLng | null = dto.drop ?? pointOrNull(order.latitude, order.longitude);
    if (!drop) drop = (await geocodeAddress(order.address)) ?? { ...STORE_LOCATION };

    const route = await fetchRoute(pickup, drop);
    const tuples = route.polyline.map(toTuple);

    const driverId = dto.driverId ?? order.delivery_partner_id;
    const becomesShipped = !!driverId && order.status === 'confirmed';
    const newStatus = becomesShipped ? 'shipped' : order.status;

    await db.query(
      `UPDATE orders SET
         delivery_partner_id = COALESCE($2, delivery_partner_id),
         status              = $3,
         accepted_at         = CASE WHEN $4 THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
         pickup_lat          = $5,
         pickup_lng          = $6,
         latitude            = COALESCE(latitude, $7),
         longitude           = COALESCE(longitude, $8),
         route_polyline      = $9::jsonb,
         route_distance_km   = $10,
         route_eta_minutes   = $11,
         tracking_phase      = COALESCE(tracking_phase, 'preparing'),
         tracking_started_at = COALESCE(tracking_started_at, NOW()),
         tracking_eta_minutes           = $11,
         tracking_distance_remaining_km = $10,
         tracking_progress   = COALESCE(tracking_progress, 0)
       WHERE id = $1`,
      [
        orderId, driverId ?? null, newStatus, becomesShipped,
        pickup.lat, pickup.lng, drop.lat, drop.lng,
        JSON.stringify(tuples), route.distanceKm, route.estimatedMinutes,
      ]
    );

    if (becomesShipped) {
      OrderEmailService.notifyStatusChange(orderId, order.status as OrderStatus, 'shipped').catch((err) =>
        console.error(`📧 Failed to send out-for-delivery email for order ${orderId}:`, (err as Error).message)
      );
    }

    return (await this.getTracking(orderId))!;
  },

  /**
   * The GPS ping pipeline: validate → debounce → snap → deviation → ETA → phase →
   * persist. Returns what (if anything) should be broadcast. Never calls OSRM.
   */
  async processPing(ping: DriverPing): Promise<PingResult> {
    const { rows } = await db.query<{
      status: string; delivery_partner_id: number | null;
      route_polyline: LatLngTuple[] | null;
      route_distance_km: string | null; route_eta_minutes: number | null;
      pickup_lat: string | null; pickup_lng: string | null;
      latitude: string | null; longitude: string | null;
      tracking_phase: LivePhase | null; tracking_last_ping_at: Date | null;
      user_id: number;
    }>(
      `SELECT status, delivery_partner_id, route_polyline, route_distance_km, route_eta_minutes,
              pickup_lat, pickup_lng, latitude, longitude, tracking_phase, tracking_last_ping_at, user_id
       FROM orders WHERE id = $1`,
      [ping.orderId]
    );
    const o = rows[0];
    if (!o) return { processed: false, reason: 'not-found' };
    if (!o.route_polyline?.length) return { processed: false, reason: 'no-route' };
    if (o.status !== 'shipped') return { processed: false, reason: 'not-live' };
    if (o.delivery_partner_id !== ping.driverId) return { processed: false, reason: 'not-assigned' };

    // Debounce noisy GPS — only one ping per DEBOUNCE_MS window is processed.
    if (o.tracking_last_ping_at && Date.now() - o.tracking_last_ping_at.getTime() < DEBOUNCE_MS) {
      return { processed: false, reason: 'debounced' };
    }

    const raw: LatLng = { lat: ping.lat, lng: ping.lng };
    const poly = o.route_polyline.map(fromTuple);
    const snap = snapToRoute(poly, raw);
    // A ping that lands nowhere near this order's own route is bogus GPS —
    // checked against the route itself so it works for a delivery in any city,
    // not just a fixed global bounding box.
    if (snap.distanceToRouteKm > MAX_PING_DEVIATION_KM) {
      return { processed: false, reason: 'out-of-bounds' };
    }

    const pickup = pointOrNull(o.pickup_lat, o.pickup_lng) ?? STORE_LOCATION;
    const drop = pointOrNull(o.latitude, o.longitude) ?? poly[poly.length - 1];

    const distToPickup = haversineKm(raw, pickup);
    const distToDrop = haversineKm(raw, drop);
    // Derive the live ETA speed from this order's own OSRM-estimated route
    // (distance/duration) rather than a flat "city speed" — a fixed 18 km/h
    // wildly under/over-estimates ETA once trips aren't all short in-city hops.
    const routeDistanceKm = toNum(o.route_distance_km);
    const routeHours = (o.route_eta_minutes ?? 0) / 60;
    const routeSpeedKmh =
      routeDistanceKm && routeHours > 0 ? routeDistanceKm / routeHours : CITY_SPEED_KMH;
    const eta = etaMinutes(snap.distanceRemainingKm, routeSpeedKmh);

    const oldPhase = o.tracking_phase;
    // Capped at 'nearby' by computePhase — GPS proximity is a strong hint the
    // driver has arrived, not proof of handoff. The order only reaches
    // 'delivered' via the OTP-confirmed DeliveryService.markDelivered (or an
    // explicit admin override), never automatically from a ping.
    const newPhase = computePhase(oldPhase, distToPickup, distToDrop, snap.progress);

    const heading = ping.heading ?? 0;
    const speed = ping.speed ?? 0;
    const ts = ping.timestamp ?? Date.now();

    await db.query(
      `UPDATE orders SET
         driver_lat = $2, driver_lng = $3, driver_heading = $4, driver_speed = $5,
         driver_location_at = NOW(),
         tracking_phase = $6,
         tracking_last_ping_at = NOW(),
         tracking_eta_minutes = $7,
         tracking_distance_remaining_km = $8,
         tracking_progress = $9
       WHERE id = $1`,
      [
        ping.orderId, snap.snapped.lat, snap.snapped.lng, heading, speed,
        newPhase, eta, Number(snap.distanceRemainingKm.toFixed(2)), Number(snap.progress.toFixed(4)),
      ]
    );

    const broadcast: LocationBroadcast = {
      orderId: ping.orderId,
      lat: snap.snapped.lat,
      lng: snap.snapped.lng,
      heading, speed, eta,
      distanceRemaining: Number(snap.distanceRemainingKm.toFixed(2)),
      progress: Number(snap.progress.toFixed(4)),
      phase: newPhase,
      status: o.status,
      timestamp: ts,
    };

    return {
      processed: true,
      broadcast,
      statusChange:
        newPhase !== oldPhase
          ? { orderId: ping.orderId, oldPhase, newPhase, timestamp: ts }
          : undefined,
    };
  },

  /** Manual phase override from admin/driver (POST /:id/status). */
  async setPhase(orderId: number, phase: LivePhase): Promise<{ state: TrackingState; oldPhase: LivePhase | null } | null> {
    const { rows } = await db.query<{ tracking_phase: LivePhase | null; status: string; user_id: number }>(
      `SELECT tracking_phase, status, user_id FROM orders WHERE id = $1`,
      [orderId]
    );
    const o = rows[0];
    if (!o) return null;
    const delivered = phase === 'delivered';

    await db.query(
      `UPDATE orders SET
         tracking_phase = $2,
         status = CASE WHEN $3 THEN 'delivered' ELSE status END,
         tracking_delivered_at = CASE WHEN $3 THEN COALESCE(tracking_delivered_at, NOW()) ELSE tracking_delivered_at END
       WHERE id = $1`,
      [orderId, phase, delivered]
    );

    if (delivered && o.status !== 'delivered') {
      await NotificationsService.create({
        userId: o.user_id,
        title: `Order #${orderId} delivered ✅`,
        body: 'Your order has arrived. Thanks for shopping with MedPet!',
        type: 'order',
      }).catch(() => undefined);

      OrderEmailService.notifyStatusChange(orderId, o.status as OrderStatus, 'delivered').catch((err) =>
        console.error(`📧 Failed to send order-delivered email for order ${orderId}:`, (err as Error).message)
      );
    }

    const state = (await this.getTracking(orderId))!;
    return { state, oldPhase: o.tracking_phase };
  },

  /** All out-for-delivery orders with a live position, for the admin map. */
  async listActiveDrivers(): Promise<ActiveDriver[]> {
    const { rows } = await db.query<{
      id: number; status: string; tracking_phase: LivePhase | null; delivery_partner_id: number | null;
      driver_lat: string | null; driver_lng: string | null; driver_heading: string | null;
      tracking_eta_minutes: number | null; tracking_distance_remaining_km: string | null;
      customer_name: string; driver_name: string | null;
    }>(
      `SELECT o.id, o.status, o.tracking_phase, o.delivery_partner_id,
              o.driver_lat, o.driver_lng, o.driver_heading,
              o.tracking_eta_minutes, o.tracking_distance_remaining_km,
              u.name AS customer_name, dp.name AS driver_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN users dp ON dp.id = o.delivery_partner_id
       WHERE o.status = 'shipped'
       ORDER BY o.accepted_at DESC NULLS LAST`
    );
    return rows.map((r) => ({
      orderId: r.id,
      orderNumber: orderNumber(r.id),
      status: r.status,
      phase: r.tracking_phase,
      driverId: r.delivery_partner_id,
      driverName: r.driver_name,
      customerName: r.customer_name,
      lat: toNum(r.driver_lat),
      lng: toNum(r.driver_lng),
      heading: toNum(r.driver_heading),
      etaMinutes: r.tracking_eta_minutes,
      distanceRemainingKm: toNum(r.tracking_distance_remaining_km),
    }));
  },

  /**
   * Delivery analytics for the admin dashboard (Task 4C). Delivery duration uses
   * the tracking timestamps, falling back to accepted_at → updated_at for orders
   * that were delivered manually (before/without live tracking).
   */
  async getAnalytics(): Promise<DeliveryAnalytics> {
    // Reusable expression for delivery duration in minutes. `p` qualifies the
    // columns (e.g. 'o.') for queries that JOIN another table with updated_at.
    const durationExpr = (p = ''): string =>
      `EXTRACT(EPOCH FROM (COALESCE(${p}tracking_delivered_at, ${p}updated_at) - COALESCE(${p}tracking_started_at, ${p}accepted_at))) / 60`;
    const DURATION = durationExpr('');
    const DURATION_O = durationExpr('o.');

    const summaryQ = db.query<{
      avg_minutes: string | null; delivered_today: string; delivered_total: string; active_now: string;
    }>(
      `SELECT
         AVG(${DURATION}) FILTER (
           WHERE status = 'delivered' AND COALESCE(tracking_started_at, accepted_at) IS NOT NULL
             AND COALESCE(tracking_delivered_at, updated_at) > COALESCE(tracking_started_at, accepted_at)
         ) AS avg_minutes,
         COUNT(*) FILTER (WHERE status = 'delivered'
           AND COALESCE(tracking_delivered_at, updated_at)::date = CURRENT_DATE) AS delivered_today,
         COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_total,
         COUNT(*) FILTER (WHERE status = 'shipped')   AS active_now
       FROM orders`
    );

    const etaQ = db.query<{ pct: string | null }>(
      `SELECT AVG(GREATEST(0, 1 - ABS(actual - route_eta_minutes) / NULLIF(route_eta_minutes, 0))) * 100 AS pct
       FROM (
         SELECT route_eta_minutes, ${DURATION} AS actual
         FROM orders
         WHERE status = 'delivered' AND route_eta_minutes > 0
           AND tracking_delivered_at IS NOT NULL AND tracking_started_at IS NOT NULL
       ) t`
    );

    const driversQ = db.query<{ driver_id: number; name: string; deliveries: string; avg_minutes: string | null }>(
      `SELECT dp.id AS driver_id, dp.name,
              COUNT(*) AS deliveries,
              AVG(${DURATION_O}) FILTER (
                WHERE COALESCE(o.tracking_started_at, o.accepted_at) IS NOT NULL
                  AND COALESCE(o.tracking_delivered_at, o.updated_at) > COALESCE(o.tracking_started_at, o.accepted_at)
              ) AS avg_minutes
       FROM orders o JOIN users dp ON dp.id = o.delivery_partner_id
       WHERE o.status = 'delivered'
       GROUP BY dp.id, dp.name
       ORDER BY deliveries DESC
       LIMIT 8`
    );

    const zonesQ = db.query<{ lat: string; lng: string; count: string }>(
      `SELECT ROUND(latitude::numeric, 2) AS lat, ROUND(longitude::numeric, 2) AS lng, COUNT(*) AS count
       FROM orders
       WHERE status = 'delivered' AND latitude IS NOT NULL AND longitude IS NOT NULL
       GROUP BY 1, 2
       ORDER BY count DESC
       LIMIT 8`
    );

    const [summary, eta, drivers, zones] = await Promise.all([summaryQ, etaQ, driversQ, zonesQ]);
    const s = summary.rows[0];
    const round1 = (v: string | null): number | null => (v === null ? null : Math.round(Number(v) * 10) / 10);

    return {
      avgDeliveryMinutes: round1(s.avg_minutes),
      deliveredToday: Number(s.delivered_today),
      deliveredTotal: Number(s.delivered_total),
      activeNow: Number(s.active_now),
      etaAccuracyPct: eta.rows[0]?.pct != null ? Math.round(Number(eta.rows[0].pct)) : null,
      topDrivers: drivers.rows.map((r) => ({
        driverId: r.driver_id, name: r.name,
        deliveries: Number(r.deliveries), avgMinutes: round1(r.avg_minutes),
      })),
      zones: zones.rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lng), count: Number(r.count) })),
    };
  },
};

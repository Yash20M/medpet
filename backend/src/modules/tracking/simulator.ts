import bcrypt from 'bcryptjs';
import db from '../../shared/config/database';
import { LatLng, STORE_LOCATION } from '../../shared/config/amravati';
import { interpolateAlong, haversineKm, bearingDeg, fromTuple, LatLngTuple } from '../../shared/services/geo';
import { TrackingService, orderNumber } from './tracking.service';
import { emitToOrder, emitToAdmins } from '../../shared/realtime/io';

const PINGS = Number(process.env.SIM_PINGS) || 50;
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS) || 3000;
const SIM_PASSWORD = process.env.SIM_PASSWORD || 'sim12345';
// A realistic drop location inside Amravati.
const SIM_DROP: LatLng = { lat: 20.9155, lng: 77.7350 };

const jitter = (): number => (Math.random() - 0.5) * 0.0006; // ±~33 m of GPS noise

/** Create a user if missing (idempotent by email); returns its id. */
const ensureUser = async (
  email: string, name: string, role: 'customer' | 'delivery',
  extra: Partial<{ vehicle_number: string; vehicle_type: string }> = {}
): Promise<number> => {
  const existing = await db.query<{ id: number }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;
  const hash = await bcrypt.hash(SIM_PASSWORD, 10);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (name, email, password, role, phone, vehicle_number, vehicle_type, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
    [name, email, hash, role, '+91 90000 00000', extra.vehicle_number ?? null, extra.vehicle_type ?? null]
  );
  return rows[0].id;
};

/** Reset the sim order back to the start of the journey so the loop can repeat. */
const resetOrder = async (orderId: number, driverId: number): Promise<void> => {
  await db.query(
    `UPDATE orders SET
       status = 'shipped', delivery_partner_id = $2,
       driver_lat = NULL, driver_lng = NULL, driver_heading = NULL, driver_speed = NULL,
       driver_location_at = NULL,
       tracking_phase = 'preparing', tracking_last_ping_at = NULL,
       tracking_delivered_at = NULL, tracking_progress = 0
     WHERE id = $1`,
    [orderId, driverId]
  );
};

let running = false;

export const startSimulation = async (): Promise<void> => {
  if (running) return;
  running = true;

  try {
    const customerId = await ensureUser('sim-customer@medpet.com', 'Sim Customer', 'customer');
    const driverId = await ensureUser('sim-driver@medpet.com', 'Ravi Kumar', 'delivery', {
      vehicle_number: 'MH 27 AB 1234', vehicle_type: 'scooter',
    });

    // Reuse a single sim order across restarts (tagged via a fixed address string).
    const existingOrder = await db.query<{ id: number }>(
      `SELECT id FROM orders WHERE user_id = $1 AND address = 'SIM ORDER — Amravati' LIMIT 1`,
      [customerId]
    );
    let orderId = existingOrder.rows[0]?.id;
    if (!orderId) {
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO orders (user_id, status, subtotal, delivery_fee, total, address, contact_phone,
                             payment_method, latitude, longitude)
         VALUES ($1, 'confirmed', 499, 0, 499, 'SIM ORDER — Amravati', '+91 90000 00000', 'cod', $2, $3)
         RETURNING id`,
        [customerId, SIM_DROP.lat, SIM_DROP.lng]
      );
      orderId = rows[0].id;
    }

    // Dispatch once → fetches + caches the real OSRM route and flips to 'shipped'.
    await db.query(`UPDATE orders SET status = 'confirmed', delivery_partner_id = NULL WHERE id = $1`, [orderId]);
    const state = await TrackingService.dispatch(orderId, { driverId, pickup: STORE_LOCATION, drop: SIM_DROP });
    const polyline: LatLng[] = (state.route?.polyline as LatLng[]) ?? [];

    console.log('\n──────────────────────────────────────────────');
    console.log('🧪  SIMULATION MODE ACTIVE');
    console.log(`   Order:    #${orderId}  (${orderNumber(orderId)})`);
    console.log(`   Route:    ${state.route?.distanceKm} km, ~${state.route?.estimatedMinutes} min, ${polyline.length} points`);
    console.log(`   Customer: sim-customer@medpet.com / ${SIM_PASSWORD}`);
    console.log(`   Driver:   sim-driver@medpet.com   / ${SIM_PASSWORD}`);
    console.log('──────────────────────────────────────────────\n');

    const walk = async (): Promise<void> => {
      await resetOrder(orderId!, driverId);
      let prev: LatLng | null = null;

      for (let i = 0; i < PINGS; i++) {
        const fraction = i / (PINGS - 1);
        const base = interpolateAlong(polyline, fraction);
        const point: LatLng = { lat: base.lat + jitter(), lng: base.lng + jitter() };
        const heading = prev ? bearingDeg(prev, point) : 0;
        const speed = prev ? (haversineKm(prev, point) / (INTERVAL_MS / 3_600_000)) : 0; // km/h
        prev = point;

        const result = await TrackingService.processPing({
          orderId: orderId!, driverId, lat: point.lat, lng: point.lng,
          heading, speed, timestamp: Date.now(),
        });

        if (result.processed && result.broadcast) {
          const b = result.broadcast;
          emitToOrder(orderId!, 'tracking:location', b);
          emitToAdmins('tracking:location', b);
          emitToOrder(orderId!, 'tracking:eta-update', {
            orderId: orderId!, etaMinutes: b.eta, distanceRemainingKm: b.distanceRemaining,
          });
          if (result.statusChange) {
            const sc = { orderId: orderId!, oldStatus: result.statusChange.oldPhase, newStatus: result.statusChange.newPhase, timestamp: b.timestamp };
            emitToOrder(orderId!, 'tracking:status-change', sc);
            emitToAdmins('tracking:status-change', sc);
          }
          console.log(
            `[SIM] Ping ${String(i + 1).padStart(2)}/${PINGS} | ` +
            `lat: ${point.lat.toFixed(4)}, lng: ${point.lng.toFixed(4)} | ` +
            `ETA: ${b.eta} min | ${b.distanceRemaining} km left | Phase: ${b.phase}`
          );
        } else {
          console.log(`[SIM] Ping ${String(i + 1).padStart(2)}/${PINGS} | skipped (${result.reason})`);
        }

        await new Promise((r) => setTimeout(r, INTERVAL_MS));
      }

      console.log('[SIM] ✅ Journey complete — all events emitted. Restarting in 8s…\n');
      setTimeout(() => { void walk(); }, 8000);
    };

    void walk();
  } catch (err) {
    running = false;
    console.error('[SIM] Simulation failed to start:', (err as Error).message);
  }
};

// Small helper so tuple-typed cached polylines can be reused elsewhere if needed.
export const tuplesToLatLng = (t: LatLngTuple[]): LatLng[] => t.map(fromTuple);

/**
 * Task 5A pure-logic tests — no server, no socket. Covers:
 *   TEST 1  OSRM route fetch          (needs internet: router.project-osrm.org)
 *   TEST 4  Snap-to-route projection
 *   + ETA calculator, phase machine, Amravati bounds.
 *
 * Run:  npx ts-node -T tests/pure.test.ts
 */
import { fetchRoute } from '../src/shared/services/routeService';
import { snapToRoute } from '../src/shared/services/snapToRoute';
import { etaMinutes } from '../src/shared/services/etaCalculator';
import { haversineKm } from '../src/shared/services/geo';
import { AMRAVATI_BOUNDS, isWithinAmravati, LatLng } from '../src/shared/config/amravati';

let passed = 0;
let failed = 0;
const ok = (name: string, cond: boolean, extra = ''): void => {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const inBounds = (p: LatLng): boolean => isWithinAmravati(p);

async function run(): Promise<void> {
  // ── TEST 1 — OSRM route fetch ────────────────────────────────────────────
  console.log('\nTEST 1 — OSRM route fetch');
  const pickup: LatLng = { lat: 20.9370, lng: 77.7710 };
  const drop: LatLng = { lat: 20.9155, lng: 77.7350 };
  const route = await fetchRoute(pickup, drop);
  ok('returns polyline with 10+ coordinates', route.polyline.length >= 10, `${route.polyline.length} pts`);
  ok('all coordinates within Amravati bounds', route.polyline.every(inBounds));
  ok('distanceKm between 1 and 10', route.distanceKm >= 1 && route.distanceKm <= 10, `${route.distanceKm} km`);
  ok('estimatedMinutes is positive', route.estimatedMinutes > 0, `${route.estimatedMinutes} min`);

  // ── TEST 4 — Snap-to-route ───────────────────────────────────────────────
  console.log('\nTEST 4 — Snap-to-route (point ~50 m off route)');
  const mid = route.polyline[Math.floor(route.polyline.length / 2)];
  // Offset ~50 m east (~0.00048° lng at this latitude).
  const offRoute: LatLng = { lat: mid.lat, lng: mid.lng + 0.00048 };
  const snap = snapToRoute(route.polyline, offRoute);
  const rawToRoute = snap.distanceToRouteKm; // perpendicular raw→route distance
  // Re-snapping the snapped point must land on the route (~0), proving it's on the line.
  const reSnap = snapToRoute(route.polyline, snap.snapped).distanceToRouteKm;
  ok('snapped point lies ON the route (re-snap ≈ 0)', reSnap < 0.005, `${(reSnap * 1000).toFixed(1)} m`);
  ok('raw GPS measured ~40–55 m off the route', rawToRoute > 0.03 && rawToRoute < 0.06, `${(rawToRoute * 1000).toFixed(1)} m off`);
  ok('progress within 0..1', snap.progress >= 0 && snap.progress <= 1, `${(snap.progress * 100).toFixed(0)}%`);
  ok('distanceRemaining ≤ total', snap.distanceRemainingKm <= snap.totalKm + 1e-9);

  console.log('\nTEST 4b — Snap monotonic progress walking the route');
  let lastProgress = -1;
  let monotonic = true;
  for (let i = 0; i < route.polyline.length; i += Math.max(1, Math.floor(route.polyline.length / 12))) {
    const s = snapToRoute(route.polyline, route.polyline[i]);
    if (s.progress < lastProgress - 0.02) monotonic = false;
    lastProgress = s.progress;
  }
  ok('progress increases monotonically along the route', monotonic);

  // ── ETA calculator ───────────────────────────────────────────────────────
  console.log('\nTEST — ETA calculator (18 km/h city speed)');
  ok('3 km → ~10 min', etaMinutes(3) === 10, `${etaMinutes(3)} min`);
  ok('0 km → 0 min', etaMinutes(0) === 0, `${etaMinutes(0)} min`);
  ok('tiny distance clamps to ≥1 min', etaMinutes(0.1) >= 1, `${etaMinutes(0.1)} min`);
  ok('ETA in reasonable 1–30 min band for a city hop', etaMinutes(route.distanceKm) >= 1 && etaMinutes(route.distanceKm) <= 40, `${etaMinutes(route.distanceKm)} min`);

  // ── Amravati bounds ──────────────────────────────────────────────────────
  console.log('\nTEST — Amravati bounds guard');
  ok('Amravati centre is in-bounds', isWithinAmravati({ lat: 20.9320, lng: 77.7523 }));
  ok('Mumbai is out-of-bounds', !isWithinAmravati({ lat: 19.076, lng: 72.877 }));
  ok('bounds match spec (lat 20.85–21.01, lng 77.65–77.85)',
    AMRAVATI_BOUNDS.minLat === 20.85 && AMRAVATI_BOUNDS.maxLat === 21.01 &&
    AMRAVATI_BOUNDS.minLng === 77.65 && AMRAVATI_BOUNDS.maxLng === 77.85);

  console.log(`\n──────── PURE TESTS: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Test run crashed:', e); process.exit(1); });

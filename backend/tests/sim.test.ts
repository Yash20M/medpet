/**
 * Smoke test for SIMULATION_MODE: boots the real server + socket layer, starts
 * the simulator, subscribes to the admin 'all' firehose, and verifies the fake
 * rider emits real, moving, phase-advancing tracking events.
 *
 * Run:  SIM_INTERVAL_MS=600 SIM_PINGS=14 npx ts-node -T tests/sim.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { io as ioClient } from 'socket.io-client';
import createApp from '../src/app';
import { attachSockets } from '../src/shared/realtime/socket';
import { startSimulation } from '../src/modules/tracking/simulator';
import db from '../src/shared/config/database';

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, extra = ''): void => {
  if (c) { passed++; console.log(`  ✓ ${n}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); }
};

async function run(): Promise<void> {
  const server = http.createServer(createApp());
  attachSockets(server);
  await new Promise<void>((res) => server.listen(0, res));
  const port = (server.address() as import('net').AddressInfo).port;

  const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
  const locations: any[] = [];
  const phases = new Set<string>();

  client.on('connect', () => client.emit('admin:subscribe', 'all'));
  client.on('tracking:location', (d) => { locations.push(d); phases.add(d.phase); });
  client.on('tracking:status-change', (d) => phases.add(d.newStatus));

  console.log('\nSIMULATION smoke test — booting fake rider…');
  await startSimulation();

  // Wait until we have enough evidence, or bail after 40s.
  await new Promise<void>((resolve) => {
    const deadline = Date.now() + 40_000;
    const t = setInterval(() => {
      if (locations.length >= 8 || phases.has('delivered') || Date.now() > deadline) {
        clearInterval(t); resolve();
      }
    }, 400);
  });

  ok('simulator emitted live location events', locations.length >= 5, `${locations.length} events`);
  const moved = locations.length >= 2 &&
    (locations[0].lat !== locations[locations.length - 1].lat || locations[0].lng !== locations[locations.length - 1].lng);
  ok('driver position actually moves between pings', moved,
    `${locations[0]?.lat?.toFixed(4)},${locations[0]?.lng?.toFixed(4)} → ${locations[locations.length - 1]?.lat?.toFixed(4)},${locations[locations.length - 1]?.lng?.toFixed(4)}`);
  ok('ETA present and non-increasing', locations.length >= 2 && locations[locations.length - 1].eta <= locations[0].eta,
    `${locations[0]?.eta} → ${locations[locations.length - 1]?.eta} min`);
  ok('phases advanced beyond preparing', [...phases].some((p) => ['picked', 'on_the_way', 'nearby', 'delivered'].includes(p)),
    [...phases].join(', '));

  client.close();
  await new Promise<void>((r) => server.close(() => r()));
  await db.pool.end();
  console.log(`\n──────── SIM SMOKE: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Sim smoke crashed:', e); process.exit(1); });

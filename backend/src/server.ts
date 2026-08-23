import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import createApp from './app';
import { ensureAdminExists } from './shared/config/ensureAdmin';
import { attachSockets } from './shared/realtime/socket';
import { startSimulation } from './modules/tracking/simulator';

const PORT = Number(process.env.PORT) || 5000;

async function start(): Promise<void> {
  await ensureAdminExists();

  const app = createApp();
  const server = http.createServer(app);
  attachSockets(server); // Socket.IO on the same HTTP server / port

  server.listen(PORT, () => {
    console.log(`\n🐾  MedPet API`);
    console.log(`   ▸ http://localhost:${PORT}/health`);
    console.log(`   ▸ Socket.IO ready (ws://localhost:${PORT})`);
    console.log(`   ▸ ENV: ${process.env.NODE_ENV ?? 'development'}\n`);

    if (process.env.SIMULATION_MODE === 'true') {
      void startSimulation();
    }
  });
}

start();

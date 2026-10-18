import { seedAccessoriesIfNone } from './seed';
import db from './database';

seedAccessoriesIfNone()
  .then((n) => console.log(n ? `🎀 Added ${n} demo accessories.` : 'Accessories already exist — nothing to do.'))
  .catch((e) => { console.error('❌ Failed:', e); process.exitCode = 1; })
  .finally(() => db.pool.end());

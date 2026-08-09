import { createPool } from '../db.js';
import { markStalePendingUnknown, purgeExpiredReceipts } from '../sweeper.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const db = createPool(databaseUrl);

console.log('[OnceGate Sweeper Worker] Started stale receipt sweeper...');

async function run() {
  try {
    const swept = await markStalePendingUnknown(db);
    if (swept > 0) console.log(`[OnceGate Sweeper Worker] Swept ${swept} stale PENDING receipts to UNKNOWN.`);
    const purged = await purgeExpiredReceipts(db);
    if (purged > 0) console.log(`[OnceGate Sweeper Worker] Purged ${purged} expired receipts.`);
  } catch (error) {
    console.error('[OnceGate Sweeper Worker] Error sweeping receipts:', error);
  }
}

void run();
const timer = setInterval(() => void run(), 5000);

process.on('SIGINT', async () => {
  clearInterval(timer);
  await db.end();
  process.exit(0);
});

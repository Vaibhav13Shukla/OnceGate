import { loadConfig } from '../config.js';
import { createPool } from '../db.js';
import { markStalePendingUnknown } from '../sweeper.js';

const config = loadConfig();
const db = createPool(config.databaseUrl);

console.log('[OnceGate Sweeper Worker] Started stale receipt sweeper...');

async function run() {
  try {
    const swept = await markStalePendingUnknown(db);
    if (swept > 0) {
      console.log(`[OnceGate Sweeper Worker] Swept ${swept} stale PENDING receipts to UNKNOWN.`);
    }
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

import { config } from './config.js';
import { openDb, applySchema } from './db.js';
import { seedIfEmpty } from './seed.js';
import { createApp } from './app.js';

const db = openDb(config.dbPath);
applySchema(db);
if (config.seedOnStart) {
  const seeded = seedIfEmpty(db);
  if (seeded) console.log(`Seeded ${seeded.inserted} internships`);
}

const server = createApp(db).listen(config.port, () => {
  console.log(`Internship Board API listening on port ${config.port} (${config.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

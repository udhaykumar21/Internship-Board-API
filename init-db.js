import { config } from '../src/config.js';
import { openDb, applySchema } from '../src/db.js';

const db = openDb(config.dbPath);
applySchema(db);
console.log(`Schema applied to ${config.dbPath}`);
db.close();

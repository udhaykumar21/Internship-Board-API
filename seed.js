import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInternship } from './validation.js';
import { createInternship, countInternships } from './repository.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SEED_PATH = path.join(here, '..', 'data', 'internship-records-sample.json');

export function loadSeedRecords() {
  const parsed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.internships;
}

/** Inserts the supplied seed records, preserving their IDs. Existing IDs are skipped. */
export function seedDatabase(db, { reset = false } = {}) {
  if (reset) {
    db.exec('DELETE FROM applications; DELETE FROM internships;');
  }
  let inserted = 0;
  for (const record of loadSeedRecords()) {
    const { value, errors } = validateInternship(record, { allowId: true });
    if (errors.length) {
      throw new Error(`Seed record ${record.id} is invalid: ${JSON.stringify(errors)}`);
    }
    const exists = db.prepare('SELECT 1 AS x FROM internships WHERE id = ?').get(value.id);
    if (exists) continue;
    createInternship(db, value);
    inserted += 1;
  }
  return { inserted, total: countInternships(db) };
}

export function seedIfEmpty(db) {
  return countInternships(db) === 0 ? seedDatabase(db) : null;
}

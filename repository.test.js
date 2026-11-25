import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, applySchema } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import {
  listInternships, getInternship, createInternship, replaceInternship,
  deleteInternship, createApplication,
} from '../src/repository.js';
import { parseListQuery } from '../src/validation.js';

function freshDb() {
  const db = openDb(':memory:');
  applySchema(db);
  seedDatabase(db);
  return db;
}
const list = (db, q = {}) => listInternships(db, parseListQuery(q).query);

test('seeding preserves the supplied IDs and is idempotent', () => {
  const db = freshDb();
  assert.deepEqual(list(db).items.map((i) => i.id), ['INT-101', 'INT-102', 'INT-103', 'INT-104', 'INT-105']);
  assert.equal(seedDatabase(db).inserted, 0);
});

test('pagination slices and counts correctly', () => {
  const db = freshDb();
  const page2 = list(db, { page: '2', limit: '2' });
  assert.equal(page2.total, 5);
  assert.deepEqual(page2.items.map((i) => i.id), ['INT-103', 'INT-104']);
  assert.equal(list(db, { page: '9' }).items.length, 0);
});

test('filters: domain, mode, skill, search, sort', () => {
  const db = freshDb();
  assert.equal(list(db, { domain: 'full stack development' }).total, 2);
  assert.equal(list(db, { mode: 'remote' }).total, 3);
  assert.deepEqual(list(db, { skill: 'sql' }).items.map((i) => i.id), ['INT-102', 'INT-104']);
  assert.deepEqual(list(db, { q: 'pune' }).items.map((i) => i.id), ['INT-102']);
  assert.equal(list(db, { q: '%' }).total, 0); // wildcards are escaped
  assert.equal(list(db, { sort: '-openings' }).items[0].id, 'INT-101');
});

test('create assigns the next ID; explicit duplicate ID is a 409', () => {
  const db = freshDb();
  const created = createInternship(db, {
    title: 'Test Intern', domain: 'QA', mode: 'Remote', location: 'Delhi', skills: ['Jest'], openings: 1,
  });
  assert.equal(created.id, 'INT-106');
  assert.equal(created.applications_open, true);
  assert.throws(() => createInternship(db, { ...created, id: 'INT-101' }), (e) => e.status === 409);
});

test('replace updates fields and bumps updated_at', () => {
  const db = freshDb();
  const before = getInternship(db, 'INT-101');
  const after = replaceInternship(db, 'INT-101', { ...before, openings: 9, applications_open: false });
  assert.equal(after.openings, 9);
  assert.equal(after.applications_open, false);
  assert.equal(replaceInternship(db, 'INT-999', before), null);
});

test('applications: success, duplicate, closed, unknown internship', () => {
  const db = freshDb();
  const app = { applicant_name: 'Asha', applicant_email: 'asha@example.com' };
  assert.equal(createApplication(db, 'INT-101', app).internship_id, 'INT-101');
  assert.throws(() => createApplication(db, 'INT-101', app), (e) => e.code === 'DUPLICATE_APPLICATION');
  assert.throws(() => createApplication(db, 'INT-999', app), (e) => e.status === 404);
  const closed = replaceInternship(db, 'INT-102', { ...getInternship(db, 'INT-102'), applications_open: false });
  assert.equal(closed.applications_open, false);
  assert.throws(() => createApplication(db, 'INT-102', app), (e) => e.code === 'APPLICATIONS_CLOSED');
});

test('delete: 404-style false for unknown, blocked when applications exist', () => {
  const db = freshDb();
  createApplication(db, 'INT-101', { applicant_name: 'Asha', applicant_email: 'a@example.com' });
  assert.throws(() => deleteInternship(db, 'INT-101'), (e) => e.code === 'HAS_APPLICATIONS');
  assert.equal(deleteInternship(db, 'INT-103'), true);
  assert.equal(deleteInternship(db, 'INT-103'), false);
});

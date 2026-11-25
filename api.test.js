// End-to-end HTTP tests. Run with: npm install && npm test
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, applySchema } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  const db = openDb(':memory:');
  applySchema(db);
  seedDatabase(db);
  server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/v1/internships`;
});
after(() => server.close());

const call = async (path, { method = 'GET', body, raw } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined || raw ? { 'Content-Type': 'application/json' } : {},
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
};

const newRecord = {
  title: 'QA Intern', domain: 'Testing', mode: 'Hybrid', location: 'Chennai', skills: ['Jest'], openings: 1,
};

test('GET list returns envelope with pagination metadata', async () => {
  const { status, json } = await call('?page=1&limit=2');
  assert.equal(status, 200);
  assert.equal(json.status, 'success');
  assert.equal(json.data.length, 2);
  assert.deepEqual(json.pagination, { page: 1, limit: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: false });
});

test('GET list rejects invalid query with 400', async () => {
  const { status, json } = await call('?limit=500');
  assert.equal(status, 400);
  assert.equal(json.error.code, 'VALIDATION_ERROR');
});

test('GET detail: 200, 404 and malformed id 400', async () => {
  assert.equal((await call('/INT-101')).status, 200);
  const missing = await call('/INT-999');
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, 'NOT_FOUND');
  assert.equal((await call('/nope')).status, 400);
});

test('POST creates (201 + Location) and validates input', async () => {
  const created = await call('', { method: 'POST', body: newRecord });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('location'), `/api/v1/internships/${created.json.data.id}`);

  const bad = await call('', { method: 'POST', body: { ...newRecord, title: '', apply_url: 'javascript:alert(1)' } });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.json.error.details.map((d) => d.field).sort(), ['apply_url', 'title']);

  const malformed = await call('', { method: 'POST', raw: '{oops' });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, 'INVALID_JSON');
});

test('PUT replaces, PATCH updates, DELETE removes', async () => {
  const { json: { data } } = await call('', { method: 'POST', body: newRecord });
  const put = await call(`/${data.id}`, { method: 'PUT', body: { ...newRecord, openings: 7 } });
  assert.equal(put.json.data.openings, 7);
  const patch = await call(`/${data.id}`, { method: 'PATCH', body: { applications_open: false } });
  assert.equal(patch.json.data.applications_open, false);
  assert.equal((await call(`/${data.id}`, { method: 'PATCH', body: {} })).status, 400);
  assert.equal((await call(`/${data.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/${data.id}`)).status, 404);
});

test('applications: created, duplicate rejected, invalid rejected', async () => {
  const body = { applicant_name: 'Asha', applicant_email: 'asha@example.com' };
  assert.equal((await call('/INT-102/applications', { method: 'POST', body })).status, 201);
  const dup = await call('/INT-102/applications', { method: 'POST', body });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error.code, 'DUPLICATE_APPLICATION');
  const bad = await call('/INT-102/applications', { method: 'POST', body: { applicant_email: 'x' } });
  assert.equal(bad.status, 400);
});

test('unknown routes return the standard error envelope', async () => {
  const res = await fetch(base.replace('/internships', '/nothing'));
  assert.equal(res.status, 404);
  assert.equal((await res.json()).status, 'error');
});

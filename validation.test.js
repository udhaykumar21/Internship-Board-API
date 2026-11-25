import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInternship, validateApplication, parseListQuery } from '../src/validation.js';

const valid = {
  title: 'Backend Intern',
  domain: 'Full Stack Development',
  mode: 'remote',
  location: 'Chennai',
  skills: ['Node.js', 'SQL'],
  openings: 2,
};

test('accepts a valid internship and normalises mode', () => {
  const { value, errors } = validateInternship(valid);
  assert.equal(errors.length, 0);
  assert.equal(value.mode, 'Remote');
});

test('reports every missing required field', () => {
  const { errors } = validateInternship({});
  const fields = errors.map((e) => e.field).sort();
  assert.deepEqual(fields, ['domain', 'location', 'mode', 'openings', 'skills', 'title']);
});

test('rejects wrong types, bad enums and unknown fields', () => {
  const { errors } = validateInternship({ ...valid, openings: '2', mode: 'Moon', skills: [], hacker: 1 });
  const fields = errors.map((e) => e.field).sort();
  assert.deepEqual(fields, ['hacker', 'mode', 'openings', 'skills']);
});

test('rejects non-object bodies', () => {
  assert.equal(validateInternship(undefined).errors[0].field, 'body');
  assert.equal(validateInternship([]).errors[0].field, 'body');
});

test('rejects duplicate skills ignoring case', () => {
  assert.ok(validateInternship({ ...valid, skills: ['SQL', 'sql'] }).errors.length > 0);
});

test('PATCH needs at least one field and allows a subset', () => {
  assert.equal(validateInternship({}, { partial: true }).errors.length, 1);
  assert.equal(validateInternship({ openings: 0 }, { partial: true }).errors.length, 0);
});

test('id is only accepted when allowId is set', () => {
  assert.ok(validateInternship({ ...valid, id: 'INT-500' }).errors.length > 0);
  assert.equal(validateInternship({ ...valid, id: 'int-500' }, { allowId: true }).value.id, 'INT-500');
  assert.ok(validateInternship({ ...valid, id: 'X-1' }, { allowId: true }).errors.length > 0);
});

test('apply_url rejects unsafe URLs', () => {
  for (const bad of ['javascript:alert(1)', 'ftp://x.com/a', 'https://user:pw@x.com', 'not a url', 'data:text/html,hi']) {
    assert.ok(validateInternship({ ...valid, apply_url: bad }).errors.length > 0, bad);
  }
  assert.equal(validateInternship({ ...valid, apply_url: 'https://example.com/apply' }).errors.length, 0);
  assert.equal(validateInternship({ ...valid, apply_url: null }).errors.length, 0);
});

test('applications: missing name, bad email and unsafe portfolio URL', () => {
  const { errors } = validateApplication({ applicant_email: 'nope', portfolio_url: 'javascript:alert(1)' });
  assert.deepEqual(errors.map((e) => e.field).sort(), ['applicant_email', 'applicant_name', 'portfolio_url']);
  const ok = validateApplication({ applicant_name: 'Asha', applicant_email: ' Asha@Example.COM ' });
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.value.applicant_email, 'asha@example.com');
});

test('list query: defaults, bounds and sort whitelist', () => {
  const d = parseListQuery({});
  assert.equal(d.query.page, 1);
  assert.equal(d.query.limit, 10);
  assert.equal(parseListQuery({ page: '0' }).errors.length, 1);
  assert.equal(parseListQuery({ limit: '51' }).errors.length, 1);
  assert.equal(parseListQuery({ limit: 'abc' }).errors.length, 1);
  assert.equal(parseListQuery({ sort: 'password' }).errors.length, 1);
  assert.equal(parseListQuery({ mode: ['a', 'b'] }).errors.length, 1);
  const s = parseListQuery({ sort: '-openings', mode: 'on-site' });
  assert.equal(s.query.direction, 'DESC');
  assert.equal(s.query.mode, 'On-site');
});

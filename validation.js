// Dependency-free validation. Every validator returns { value, errors }
// where errors is an array of { field, message }.

export const MODES = ['Remote', 'Hybrid', 'On-site'];
export const ID_PATTERN = /^INT-\d{3,}$/;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const SORT_FIELDS = ['id', 'title', 'openings', 'created_at'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---- field rules: (input) => { ok: true, value } | { ok: false, message } -------------

const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, message });

function text({ min, max }) {
  return (input) => {
    if (typeof input !== 'string') return fail('must be a string');
    const value = input.trim();
    if (value.length < min) return fail(min === 1 ? 'must not be empty' : `must be at least ${min} characters`);
    if (value.length > max) return fail(`must be at most ${max} characters`);
    if (CONTROL_CHARS.test(value)) return fail('must not contain control characters');
    return ok(value);
  };
}

function integer({ min, max }) {
  return (input) => {
    if (typeof input !== 'number' || !Number.isInteger(input)) return fail('must be an integer');
    if (input < min || input > max) return fail(`must be between ${min} and ${max}`);
    return ok(input);
  };
}

const boolean = (input) => (typeof input === 'boolean' ? ok(input) : fail('must be true or false'));

const mode = (input) => {
  if (typeof input !== 'string') return fail('must be a string');
  const match = MODES.find((m) => m.toLowerCase() === input.trim().toLowerCase());
  return match ? ok(match) : fail(`must be one of: ${MODES.join(', ')}`);
};

const skills = (input) => {
  if (!Array.isArray(input)) return fail('must be an array of strings');
  if (input.length < 1 || input.length > 10) return fail('must contain between 1 and 10 skills');
  const skill = text({ min: 1, max: 40 });
  const cleaned = [];
  for (const item of input) {
    const r = skill(item);
    if (!r.ok) return fail(`each skill ${r.message}`);
    cleaned.push(r.value);
  }
  const lower = cleaned.map((s) => s.toLowerCase());
  if (new Set(lower).size !== lower.length) return fail('must not contain duplicate skills');
  return ok(cleaned);
};

/** Only plain http(s) URLs without embedded credentials are accepted. */
const url = (input) => {
  if (typeof input !== 'string') return fail('must be a string');
  const raw = input.trim();
  if (raw.length > 2048) return fail('must be at most 2048 characters');
  if (/\s/.test(raw) || CONTROL_CHARS.test(raw)) return fail('must not contain whitespace');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return fail('must be a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('must start with http:// or https://');
  if (parsed.username || parsed.password) return fail('must not contain credentials');
  if (!parsed.hostname) return fail('must include a host name');
  return ok(parsed.toString());
};

const email = (input) => {
  if (typeof input !== 'string') return fail('must be a string');
  const value = input.trim().toLowerCase();
  if (value.length > 254 || !EMAIL_PATTERN.test(value) || CONTROL_CHARS.test(value)) {
    return fail('must be a valid email address');
  }
  return ok(value);
};

const nullable = (rule) => (input) => (input === null ? ok(null) : rule(input));

// ---- generic object validator ---------------------------------------------------------

function validateObject(body, { required, optional, partial = false }) {
  const errors = [];
  if (!isPlainObject(body)) {
    return {
      value: {},
      errors: [{ field: 'body', message: 'Request body must be a JSON object (send Content-Type: application/json)' }],
    };
  }
  const rules = { ...required, ...optional };
  const value = {};

  for (const key of Object.keys(body)) {
    if (!(key in rules)) errors.push({ field: key, message: 'is not an allowed field' });
  }
  for (const [key, rule] of Object.entries(rules)) {
    if (!(key in body) || body[key] === undefined) {
      if (!partial && key in required) errors.push({ field: key, message: 'is required' });
      continue;
    }
    const result = rule(body[key]);
    if (result.ok) value[key] = result.value;
    else errors.push({ field: key, message: result.message });
  }
  if (partial && errors.length === 0 && Object.keys(value).length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update' });
  }
  return { value, errors };
}

const idRule = (input) => {
  if (typeof input !== 'string' || !ID_PATTERN.test(input.trim().toUpperCase())) {
    return fail('must look like INT-001');
  }
  return ok(input.trim().toUpperCase());
};

/**
 * @param {object} opts
 * @param {boolean} opts.partial  true for PATCH (all fields optional, at least one required)
 * @param {boolean} opts.allowId  true for POST/seed (client may choose the ID)
 */
export function validateInternship(body, { partial = false, allowId = false } = {}) {
  return validateObject(body, {
    partial,
    required: {
      title: text({ min: 3, max: 100 }),
      domain: text({ min: 2, max: 60 }),
      mode,
      location: text({ min: 2, max: 80 }),
      skills,
      openings: integer({ min: 0, max: 1000 }),
    },
    optional: {
      ...(allowId ? { id: idRule } : {}),
      duration_weeks: nullable(integer({ min: 1, max: 52 })),
      applications_open: boolean,
      apply_url: nullable(url),
    },
  });
}

export function validateApplication(body) {
  return validateObject(body, {
    required: {
      applicant_name: text({ min: 2, max: 100 }),
      applicant_email: email,
    },
    optional: {
      portfolio_url: nullable(url),
    },
  });
}

export function parseInternshipId(raw) {
  const r = idRule(raw);
  return r.ok ? { id: r.value, errors: [] } : { id: null, errors: [{ field: 'id', message: r.message }] };
}

// ---- list query string ----------------------------------------------------------------

export function parseListQuery(query) {
  const errors = [];
  const out = { page: 1, limit: DEFAULT_LIMIT, sort: 'id', direction: 'ASC' };

  const single = (key) => {
    const v = query[key];
    if (v === undefined || v === '') return undefined;
    if (typeof v !== 'string') {
      errors.push({ field: key, message: 'must be provided once, as a single value' });
      return undefined;
    }
    return v.trim();
  };

  const intParam = (key, min, max) => {
    const v = single(key);
    if (v === undefined) return undefined;
    if (!/^\d+$/.test(v) || Number(v) < min || Number(v) > max) {
      errors.push({ field: key, message: `must be an integer between ${min} and ${max}` });
      return undefined;
    }
    return Number(v);
  };

  out.page = intParam('page', 1, 1_000_000) ?? 1;
  out.limit = intParam('limit', 1, MAX_LIMIT) ?? DEFAULT_LIMIT;

  const textFilter = (key, max = 80) => {
    const v = single(key);
    if (v === undefined) return;
    if (v.length > max || CONTROL_CHARS.test(v)) {
      errors.push({ field: key, message: `must be at most ${max} characters with no control characters` });
      return;
    }
    out[key] = v;
  };
  textFilter('q');
  textFilter('domain', 60);
  textFilter('location');
  textFilter('skill', 40);

  const modeValue = single('mode');
  if (modeValue !== undefined) {
    const r = mode(modeValue);
    if (r.ok) out.mode = r.value;
    else errors.push({ field: 'mode', message: r.message });
  }

  const open = single('applications_open');
  if (open !== undefined) {
    if (open === 'true' || open === 'false') out.applicationsOpen = open === 'true';
    else errors.push({ field: 'applications_open', message: 'must be true or false' });
  }

  const sort = single('sort');
  if (sort !== undefined) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    if (SORT_FIELDS.includes(field)) {
      out.sort = field;
      out.direction = desc ? 'DESC' : 'ASC';
    } else {
      errors.push({ field: 'sort', message: `must be one of: ${SORT_FIELDS.join(', ')} (prefix with - for descending)` });
    }
  }

  return { query: out, errors };
}

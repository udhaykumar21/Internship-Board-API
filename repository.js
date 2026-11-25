// All SQL lives here. Every statement is parameterised.
import { HttpError } from './middleware/errors.js';

const COLUMNS =
  'id, title, domain, mode, location, skills, openings, duration_weeks, applications_open, apply_url, created_at, updated_at';

const SORT_COLUMNS = {
  id: 'id',
  title: 'title COLLATE NOCASE',
  openings: 'openings',
  created_at: 'created_at',
};

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    domain: row.domain,
    mode: row.mode,
    location: row.location,
    skills: JSON.parse(row.skills),
    openings: row.openings,
    duration_weeks: row.duration_weeks ?? null,
    applications_open: row.applications_open === 1,
    apply_url: row.apply_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

function buildWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    clauses.push(
      "(title LIKE ? ESCAPE '\\' OR domain LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR skills LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like, like);
  }
  if (filters.domain) {
    clauses.push('domain = ? COLLATE NOCASE');
    params.push(filters.domain);
  }
  if (filters.mode) {
    clauses.push('mode = ?');
    params.push(filters.mode);
  }
  if (filters.location) {
    clauses.push("location LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filters.location)}%`);
  }
  if (filters.skill) {
    clauses.push('EXISTS (SELECT 1 FROM json_each(internships.skills) WHERE lower(value) = lower(?))');
    params.push(filters.skill);
  }
  if (typeof filters.applicationsOpen === 'boolean') {
    clauses.push('applications_open = ?');
    params.push(filters.applicationsOpen ? 1 : 0);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function countInternships(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM internships').get().n;
}

export function listInternships(db, query) {
  const { where, params } = buildWhere(query);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM internships ${where}`).get(...params).n;
  const orderBy = `${SORT_COLUMNS[query.sort]} ${query.direction === 'DESC' ? 'DESC' : 'ASC'}, id ASC`;
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM internships ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, query.limit, (query.page - 1) * query.limit);
  return { items: rows.map(toApi), total };
}

export function getInternship(db, id) {
  return toApi(db.prepare(`SELECT ${COLUMNS} FROM internships WHERE id = ?`).get(id));
}

function nextId(db) {
  const { n } = db.prepare('SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS n FROM internships').get();
  return `INT-${String((n ?? 0) + 1).padStart(3, '0')}`;
}

export function createInternship(db, data) {
  const id = data.id ?? nextId(db);
  if (getInternship(db, id)) {
    throw new HttpError(409, 'DUPLICATE_ID', `An internship with id ${id} already exists`);
  }
  db.prepare(
    `INSERT INTO internships (id, title, domain, mode, location, skills, openings, duration_weeks, applications_open, apply_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.title,
    data.domain,
    data.mode,
    data.location,
    JSON.stringify(data.skills),
    data.openings,
    data.duration_weeks ?? null,
    (data.applications_open ?? true) ? 1 : 0,
    data.apply_url ?? null,
  );
  return getInternship(db, id);
}

/** Writes a complete record (callers merge defaults for PUT, or existing values for PATCH). */
export function replaceInternship(db, id, data) {
  const result = db
    .prepare(
      `UPDATE internships
         SET title = ?, domain = ?, mode = ?, location = ?, skills = ?, openings = ?,
             duration_weeks = ?, applications_open = ?, apply_url = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
    .run(
      data.title,
      data.domain,
      data.mode,
      data.location,
      JSON.stringify(data.skills),
      data.openings,
      data.duration_weeks ?? null,
      data.applications_open ? 1 : 0,
      data.apply_url ?? null,
      id,
    );
  return result.changes > 0 ? getInternship(db, id) : null;
}

export function deleteInternship(db, id) {
  if (!getInternship(db, id)) return false;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM applications WHERE internship_id = ?').get(id);
  if (n > 0) {
    throw new HttpError(409, 'HAS_APPLICATIONS', 'Cannot delete an internship that already has applications');
  }
  return db.prepare('DELETE FROM internships WHERE id = ?').run(id).changes > 0;
}

export function createApplication(db, internshipId, data) {
  const internship = getInternship(db, internshipId);
  if (!internship) throw new HttpError(404, 'NOT_FOUND', `Internship ${internshipId} not found`);
  if (!internship.applications_open) {
    throw new HttpError(409, 'APPLICATIONS_CLOSED', `Applications for ${internshipId} are closed`);
  }
  const duplicate = db
    .prepare('SELECT 1 AS x FROM applications WHERE internship_id = ? AND applicant_email = ?')
    .get(internshipId, data.applicant_email);
  if (duplicate) {
    throw new HttpError(409, 'DUPLICATE_APPLICATION', 'This email has already applied to this internship');
  }
  const result = db
    .prepare(
      'INSERT INTO applications (internship_id, applicant_name, applicant_email, portfolio_url) VALUES (?, ?, ?, ?)',
    )
    .run(internshipId, data.applicant_name, data.applicant_email, data.portfolio_url ?? null);
  const row = db
    .prepare(
      'SELECT id, internship_id, applicant_name, applicant_email, portfolio_url, created_at FROM applications WHERE id = ?',
    )
    .get(Number(result.lastInsertRowid));
  return { ...row };
}

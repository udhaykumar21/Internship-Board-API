import { Router } from 'express';
import {
  listInternships,
  getInternship,
  createInternship,
  replaceInternship,
  deleteInternship,
  createApplication,
} from '../repository.js';
import {
  validateInternship,
  validateApplication,
  parseListQuery,
  parseInternshipId,
} from '../validation.js';
import { HttpError, validationError } from '../middleware/errors.js';

function requireId(raw) {
  const { id, errors } = parseInternshipId(raw);
  if (errors.length) throw validationError(errors, 'Invalid internship id');
  return id;
}

function requireInternship(db, id) {
  const record = getInternship(db, id);
  if (!record) throw new HttpError(404, 'NOT_FOUND', `Internship ${id} not found`);
  return record;
}

export function internshipsRouter(db) {
  const router = Router();

  // GET /api/v1/internships?page=1&limit=10&q=&domain=&mode=&location=&skill=&sort=
  router.get('/', (req, res) => {
    const { query, errors } = parseListQuery(req.query);
    if (errors.length) throw validationError(errors, 'Invalid query parameters');

    const { items, total } = listInternships(db, query);
    const totalPages = Math.ceil(total / query.limit);
    res.json({
      status: 'success',
      data: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    });
  });

  // GET /api/v1/internships/:id
  router.get('/:id', (req, res) => {
    const id = requireId(req.params.id);
    res.json({ status: 'success', data: requireInternship(db, id) });
  });

  // POST /api/v1/internships
  router.post('/', (req, res) => {
    const { value, errors } = validateInternship(req.body, { allowId: true });
    if (errors.length) throw validationError(errors);
    const created = createInternship(db, value);
    res.status(201).location(`/api/v1/internships/${created.id}`).json({ status: 'success', data: created });
  });

  // PUT /api/v1/internships/:id  (full replacement)
  router.put('/:id', (req, res) => {
    const id = requireId(req.params.id);
    requireInternship(db, id);
    const { value, errors } = validateInternship(req.body);
    if (errors.length) throw validationError(errors);
    const defaults = { duration_weeks: null, applications_open: true, apply_url: null };
    res.json({ status: 'success', data: replaceInternship(db, id, { ...defaults, ...value }) });
  });

  // PATCH /api/v1/internships/:id  (partial update)
  router.patch('/:id', (req, res) => {
    const id = requireId(req.params.id);
    const existing = requireInternship(db, id);
    const { value, errors } = validateInternship(req.body, { partial: true });
    if (errors.length) throw validationError(errors);
    res.json({ status: 'success', data: replaceInternship(db, id, { ...existing, ...value }) });
  });

  // DELETE /api/v1/internships/:id
  router.delete('/:id', (req, res) => {
    const id = requireId(req.params.id);
    if (!deleteInternship(db, id)) throw new HttpError(404, 'NOT_FOUND', `Internship ${id} not found`);
    res.status(204).end();
  });

  // POST /api/v1/internships/:id/applications
  router.post('/:id/applications', (req, res) => {
    const id = requireId(req.params.id);
    const { value, errors } = validateApplication(req.body);
    if (errors.length) throw validationError(errors);
    const application = createApplication(db, id, value);
    res.status(201).json({ status: 'success', data: application });
  });

  return router;
}

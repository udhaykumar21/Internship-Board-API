export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (details, message = 'Validation failed') =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

function send(res, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  res.status(status).json({ status: 'error', error });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) return send(res, err.status, err.code, err.message, err.details);
  if (err.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (err.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
    return send(res, 409, 'CONFLICT', 'A record with these values already exists');
  }

  // Log only safe metadata - never the request body, headers or applicant data.
  console.error(JSON.stringify({ level: 'error', id: req.id, name: err.name, message: err.message }));
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side');
}

import crypto from 'node:crypto';

/**
 * Structured access log: method, path (no query string), status and timing only.
 * Bodies, headers and query strings are never logged, so applicant records,
 * passwords and tokens cannot leak into logs.
 */
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        id: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
      }),
    );
  });
  next();
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

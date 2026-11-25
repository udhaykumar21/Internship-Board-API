import express from 'express';
import { internshipsRouter } from './routes/internships.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';
import { requestLogger, securityHeaders } from './middleware/logger.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'success', data: { uptime: process.uptime() } }));
  app.use('/api/v1/internships', internshipsRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

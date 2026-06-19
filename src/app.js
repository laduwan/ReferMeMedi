import express from 'express';
import recordsRouter from './routes/records.js';

// App factory so tests can import without binding a port.
export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/records', recordsRouter);
  return app;
}

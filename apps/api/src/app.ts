import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import './shared/container';
import { requestLogger } from './presentation/middleware/requestLogger';
import { errorHandler } from './presentation/middleware/errorHandler';
import { authGuard } from './presentation/middleware/authGuard';
import { tenantGuard } from './presentation/middleware/tenantGuard';
import { apiKeyGuard } from './presentation/middleware/apiKeyGuard';
import { authRouter } from './modules/auth/presentation/routes/auth.routes';
import { n8nRouter } from './modules/salon/presentation/routes/n8n.routes';
import { superadminRouter } from './modules/salon/presentation/routes/superadmin.routes';
import { catalogoRouter } from './modules/catalogo/presentation/routes/catalogo.routes';
import { personasRouter } from './modules/personas/presentation/routes/personas.routes';
import { agendaRouter } from './modules/agenda/presentation/routes/agenda.routes';
import { finanzasRouter } from './modules/finanzas/presentation/routes/finanzas.routes';
import planRoutes from './modules/planes/presentation/routes/planRoutes';
import logger from './shared/logger';

export function createApp(): express.Application {
  const app = express();

  // 1. Security & parsing — order matters
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
    ],
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // 2. Request logger — fires on EVERY request, non-blocking
  app.use(requestLogger);

  // 3. Health check — public, no auth
  app.get('/api/salud', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 4. n8n routes — API key auth, no JWT
  app.use('/api/n8n', apiKeyGuard, tenantGuard, n8nRouter);

  // 5. Auth routes — public (login, refresh), /me uses its own authGuard
  app.use('/api/auth', authRouter);

  // 6. Protected routes — JWT required (applied AFTER public auth routes)
  app.use('/api', authGuard, tenantGuard);
  app.use('/api/superadmin', superadminRouter);
  app.use('/api/superadmin/planes', planRoutes);
  app.use('/api/salones/:salonId', catalogoRouter);
  app.use('/api/salones/:salonId', personasRouter);
  app.use('/api/salones/:salonId', agendaRouter);
  app.use('/api/salones/:salonId', finanzasRouter);

  // 7. Global error handler — MUST be last
  app.use(errorHandler);

  logger.info('Express app created with middleware chain');
  return app;
}

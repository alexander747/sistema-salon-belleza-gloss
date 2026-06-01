import 'reflect-metadata';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock all route modules to avoid DI resolution at import time
vi.mock('../modules/auth/presentation/routes/auth.routes.js', () => ({
  authRouter: express.Router(),
}));

vi.mock('../modules/salon/presentation/routes/n8n.routes.js', () => ({
  n8nRouter: express.Router(),
}));

vi.mock('../modules/salon/presentation/routes/superadmin.routes.js', () => ({
  superadminRouter: express.Router(),
}));

vi.mock('../modules/catalogo/presentation/routes/catalogo.routes.js', () => ({
  catalogoRouter: express.Router(),
}));

vi.mock('../modules/personas/presentation/routes/personas.routes.js', () => ({
  personasRouter: express.Router(),
}));

vi.mock('../modules/agenda/presentation/routes/agenda.routes.js', () => ({
  agendaRouter: express.Router(),
}));

vi.mock('../modules/finanzas/presentation/routes/finanzas.routes.js', () => ({
  finanzasRouter: express.Router(),
}));

// Mock the shared/container module to avoid side-effect imports (DI registrations, DB connection)
vi.mock('../shared/container.js', () => ({}));

// Mock the database module
vi.mock('../shared/database.js', () => ({
  AppDataSource: {},
  initializeDatabase: vi.fn(),
}));

// Mock the logger
vi.mock('../shared/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the requestLogger (uses database)
vi.mock('../presentation/middleware/requestLogger.js', () => ({
  requestLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock middleware that touches DB
vi.mock('../presentation/middleware/apiKeyGuard.js', () => ({
  apiKeyGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../presentation/middleware/authGuard.js', () => ({
  authGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../presentation/middleware/tenantGuard.js', () => ({
  tenantGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Import after all mocks are set up
let createApp: any;

describe('Health Check', () => {
  beforeAll(async () => {
    createApp = (await import('../app.js')).createApp;
  });
  it('GET /api/salud should return 200 with status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/api/salud');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('should return a valid ISO timestamp', async () => {
    const app = createApp();
    const res = await request(app).get('/api/salud');

    const timestamp = new Date(res.body.timestamp);
    expect(timestamp.toISOString()).toBe(res.body.timestamp);
  });
});

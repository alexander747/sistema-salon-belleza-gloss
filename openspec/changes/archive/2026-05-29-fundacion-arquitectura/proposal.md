# Proposal: Fundación Arquitectónica

## Intent

Establish the foundational architecture for pos-final, a multi-tenant SaaS for beauty salons. Migrate from the pos-ok prototype to a monorepo with hexagonal backend, proper auth, testing, and structured logging. Every subsequent change depends on this foundation.

## Scope

### In Scope
- Monorepo scaffolding (Turborepo + pnpm): 3 apps + 4 packages
- Backend hexagonal layers per module: domain, application, infrastructure, presentation, shared
- Technology stack: TypeScript strict, Express 4, TypeORM with migrations, Zod, tsyringe DI, Pino logger, Vitest + Supertest
- Entity migration: 16 pos-ok entities as-is + Usuario (Rol enum) + Bitacora (audit) + Membresia (membership)
- Remove WhatsApp session logic (Baileys stays in n8n)
- Core middleware: JWT auth, role-based guards, global error handler, request logger, tenant injection (salonId)
- 3 seed endpoints: `POST /api/auth/login`, `POST /api/superadmin/salones`, `GET /api/n8n/:salonId/salon`
- Docker compose with MySQL 8 + n8n

### Out of Scope
- Full CRUD for all entities (subsequent changes)
- WhatsApp bot logic (n8n handles it)
- Frontend pages beyond login + empty dashboard shell
- Marketing campaigns, loyalty program, payment processing

## Capabilities

### New Capabilities
- `monorepo` — Turborepo/pnpm workspace with apps/ and packages/
- `shared-types` — Domain entity interfaces, enums, DTOs
- `ui-kit` — Atomic design components (Button, Input, Modal, Table, Card, Toast, Spinner)
- `auth` — JWT auth, login, refresh tokens, role-based middleware
- `salon` — Tenant entity with estado, plan, n8n API key
- `usuarios` — Staff entity with Rol enum (SUPERADMIN, DUENIA, ADMINISTRADOR, RECEPCIONISTA, MANICURISTA, CONTADOR)
- `clientes` — Customer management entity
- `catalogo` — Services catalog (CategoriaServicio, Servicio, FotoPortafolio)
- `inventario` — Product inventory (Producto, Devolucion)
- `citas` — Appointments (Cita, HorarioComercial, BloqueoAgenda)
- `ventas` — Transactions (RegistroServicio, PagoTransaccion, DivisionRegistro)
- `finanzas` — Payroll and expenses (Liquidacion, Gasto)
- `marketing` — Campaigns and loyalty (CampanaMarketing, RecompensaFidelidad, Notificacion)
- `n8n` — External AI agent API with API Key auth
- `audit` — Bitacora audit log (HTTP method, URL, body, userId, timestamp)
- `membresia` — Membership plans entity (future use)
- `middleware` — JWT guard, role guard, error handler, logger, tenant injection

### Modified Capabilities
None — this is the foundational change. No existing specs to modify. `openspec/specs/` is empty.

## Approach

Scaffold monorepo with Turborepo + pnpm. Backend uses hexagonal architecture: domain entities define the model, application orchestrates use cases with Zod-validated DTOs, infrastructure provides TypeORM persistence and tsyringe DI registrations, presentation exposes thin Express controllers.

Auth module first (JWT + refresh tokens + role guards). Salon module second (establishes hexagonal patterns). Bitacora middleware added before any business logic. TypeORM runs with `synchronize: false`, using formal migrations from day one.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `/` (root) | New | `package.json`, `turbo.json`, `tsconfig.base.json`, `docker-compose.yml` |
| `apps/backend/` | New | Express server, 18 entities, hexagonal modules, middleware, DI container |
| `apps/dashboard/` | New | React + Vite skeleton: login + empty dashboard shell |
| `apps/superadmin/` | New | React + Vite skeleton: login + salon management shell |
| `packages/shared-types/` | New | Entity interfaces, enums, DTOs |
| `packages/ui-kit/` | New | Atomic design components + design tokens |
| `packages/validation/` | New | Zod schemas for shared DTOs |
| `packages/config/` | New | ESLint, Prettier, shared TS config |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep into full CRUD | High | Hard boundary: only seed endpoints + entity definitions |
| Turborepo/pnpm learning curve | Medium | Simple initial config; fallback to npm workspaces if blocked |
| Entity migration errors (Usuario Rol enum) | Medium | Formal TypeORM migration with rollback script |
| Docker compose fails first run | Low | Use known-good MySQL 8 + n8n images with pinned versions |

## Rollback Plan

Delete the monorepo directories and `docker-compose.yml`. No data exists — this is greenfield scaffolding on an empty repo.

## Dependencies

None. This is the foundation. No prior changes exist.

## Success Criteria

- [ ] `pnpm install` succeeds at root and builds all packages
- [ ] `docker compose up` starts MySQL and n8n without errors
- [ ] `POST /api/auth/login` returns JWT for valid credentials
- [ ] `POST /api/superadmin/salones` creates tenant (superadmin auth required)
- [ ] `GET /api/n8n/:salonId/salon` returns salon data with valid API key
- [ ] `pnpm test` runs Vitest suite with all tests passing (unit + integration)
- [ ] ESLint + TypeScript strict pass with zero errors
- [ ] Bitacora records all API requests (audit log verified)
- [ ] Refresh token rotation works (logout invalidates refresh token)

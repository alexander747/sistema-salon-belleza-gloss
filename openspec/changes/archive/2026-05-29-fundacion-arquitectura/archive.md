# Archive: Fundación Arquitectónica

**Date**: 2026-05-29
**Previous path**: `openspec/changes/fundacion-arquitectura/`
**Archive path**: `openspec/changes/archive/2026-05-29-fundacion-arquitectura/`

---

## What Was Implemented

Established the complete foundational architecture for **pos-final**, a multi-tenant SaaS for beauty salons. Migrated from the pos-ok prototype to a monorepo with hexagonal backend, proper auth, testing, and structured logging.

### Architecture
- **Monorepo**: npm workspaces with 3 apps (`apps/api`, `apps/superadmin`, `apps/pos-dashboard`) and 4 shared packages (`config`, `types`, `validation`, `ui`)
- **Backend**: Express + TypeScript + TypeORM + MySQL 8, hexagonal layering per module (domain/application/infrastructure/presentation)
- **Auth**: JWT with access + refresh tokens, role-based guards (Rol enum: SUPERADMIN, DUENIA, ADMINISTRADOR, MANICURISTA, RECEPCIONISTA, CONTADOR)
- **Frontends**: React + Vite — Superadmin Portal (salon management) + POS Dashboard (staff shell)
- **Infrastructure**: Docker Compose with MySQL 8 + n8n, formal TypeORM migrations, tsyringe DI, Pino logging

### Final Stats
| Metric | Value |
|--------|-------|
| Chained PRs completed | 4 (stacked-to-main) |
| Total files created | ~138 |
| TypeORM entities | 22 (19 migrated + Bitacora + Membresia + BaseEntity) |
| Apps | 3: api (backend), superadmin (React), pos-dashboard (React) |
| Shared packages | 4: config, types, validation, ui |
| Use cases | 6 |
| Middleware | 7 |
| Controllers | 3 |
| Test files | 8 |
| Tests passing | 32 |
| Docker services | MySQL 8 + n8n |

### Key Decisions
1. **npm workspaces over Turborepo+pnpm** — Simpler setup, functionally equivalent for MVP phase
2. **apps/api over apps/backend** — Renamed during implementation for consistency with docker service naming
3. **Domain repositories import TypeORM entities** — Pragmatic tradeoff; keeps code DRY in a TypeScript/Express project where entities serve as domain objects
4. **Auth routes are public, authGuard on /me only** — More correct than the original design (login/refresh must be public)
5. **tsyringe with useClass registration** — Straightforward DI without decorator overhead on interfaces

### Lingering Warnings (from verify)
1. **Tooling**: npm workspaces instead of pnpm + Turborepo — upgrade when build caching is needed
2. **Naming**: `apps/api` vs `apps/backend` — resolve if team has strong preference
3. **Domain purity**: Domain layer imports infrastructure entities — refactor with proper domain models later
4. **Test gaps**: 8 test files missing (RefreshTokenUseCase, ListSalonesUseCase, apiKeyGuard, tenantGuard, etc.)
5. **Per-package Vitest**: Only `apps/api` has vitest config; packages/types, validation, ui do not

### Task Completion
- **45 / 47 tasks complete** (96%)
- Incomplete: ESLint per-app (deferred), live seed verification (requires MySQL)

---

## Specs Synced to Source of Truth

All 8 delta specs were copied to `openspec/specs/{domain}/spec.md` (no prior main specs existed):

| Domain | Action | Requirements |
|--------|--------|-------------|
| monorepo-scaffolding | Created | 4 requirements, 8 scenarios |
| shared-packages | Created | 5 requirements, 9 scenarios |
| backend-hexagonal | Created | 5 requirements, 10 scenarios |
| entity-layer | Created | 5 requirements, 10 scenarios |
| database | Created | 5 requirements, 10 scenarios |
| auth | Created | 7 requirements, 13 scenarios |
| api-endpoints | Created | 7 requirements, 13 scenarios |
| middleware | Created | 5 requirements, 10 scenarios |

---

## What Follows Next

### Recommended next changes (candidates):
1. **auth-completo** — password reset, email verification, rate limiting
2. **crud-catalogo** — full CRUD for categorías, servicios, productos
3. **crud-personas** — full CRUD for empleadas, clientes
4. **agenda-citas** — calendar, booking, availability
5. **n8n-integration** — complete n8n API surface (all endpoints from pos-ok)

---

*SDD cycle complete. Change archived 2026-05-29.*

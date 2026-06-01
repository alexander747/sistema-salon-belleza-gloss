# Tasks: Fundación Arquitectónica

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 5200–6500 |
| 800-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 (Foundation) → PR #2 (Data) → PR #3 (Business) → PR #4 (UI + Tests) |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
800-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Monorepo + shared packages | PR #1 | Root configs, Docker, `packages/config`, `types`, `validation`, `ui`. Base: `main` |
| 2 | Backend scaffold + database | PR #2 | Backend setup, shared utilities, 21 TypeORM entities, DataSource, migration, seed. Base: PR #1 branch |
| 3 | Auth + Salon + middleware | PR #3 | Auth module, Salon module, middleware chain, app.ts, server.ts, DI container. Base: PR #2 branch |
| 4 | Frontends + tests | PR #4 | Both React apps (superadmin + dashboard), all unit/integration tests. Base: PR #3 branch |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Create root `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc` (npm workspaces, no Turborepo)
- [x] 1.2 Create `docker-compose.yml` (MySQL 8 + n8n) and `docker/mysql/init.sql`
- [x] 1.3 Create `packages/config/` with `package.json`, `tsconfig.base.json`, `tsconfig.react.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc`
- [x] 1.4 Create `packages/types/` with `Rol` enum, `Plan` enum, `IUser`, `ISalon`, `LoginRequest`, `AuthResult`, `TokenPayload`, `JwtPayload`, `ApiResponse`, `PaginatedResponse`, `ErrorDetail`, `BitacoraEntry`
- [x] 1.5 Create `packages/validation/` with Zod schemas (`auth.schema.ts`, `salon.schema.ts`, `common.schema.ts`)
- [x] 1.6 Create `packages/ui/` with `Button`, `Input`, `Card` components and CSS modules

## Phase 2: Database Layer

- [x] 2.1 Create `apps/backend/` scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`
- [x] 2.2 Create backend shared: `config/env.ts`, `config/database.ts`, `shared/errors/` (5 error classes), `shared/types/express.d.ts`, `shared/logger.ts`, `shared/container.ts`
- [x] 2.3 Create `BaseEntity.ts` abstract class with `@PrimaryGeneratedColumn`, `@CreateDateColumn`, `@UpdateDateColumn`
- [x] 2.4 Create all 21 TypeORM entities with decorators: `SalonEntity`, `UsuarioEntity`, `ClienteEntity`, `CategoriaServicioEntity`, `ServicioEntity`, `ProductoEntity`, `CitaEntity`, `RegistroServicioEntity`, `PagoTransaccionEntity`, `GastoEntity`, `DevolucionEntity`, `FotoPortafolioEntity`, `HorarioComercialEntity`, `BloqueoAgendaEntity`, `LiquidacionEntity`, `CampanaMarketingEntity`, `NotificacionEntity`, `RecompensaFidelidadEntity`, `DivisionRegistroEntity`, `BitacoraEntity`, `MembresiaEntity`
- [x] 2.5 Generate initial migration `1716937200000-InitialSchema.ts` from TypeORM entities
- [x] 2.6 Create `seed.ts` (superadmin user + default data)

## Phase 3: Auth Module

- [x] 3.1 Create domain interfaces: `IUsuarioRepository`, `ITokenService`
- [x] 3.2 Create infrastructure: `BcryptService`, `JwtTokenService`, `TypeORMUsuarioRepository`, `auth.di.ts`
- [x] 3.3 Create use cases: `LoginUseCase`, `RefreshTokenUseCase`, `GetCurrentUserUseCase`
- [x] 3.4 Create application DTOs: `LoginInput`, `AuthOutput`
- [x] 3.5 Create presentation: `AuthController` (POST /login, POST /refresh, GET /me), `auth.routes.ts`

## Phase 4: Salon Module

- [x] 4.1 Create domain interface: `ISalonRepository`
- [x] 4.2 Create infrastructure: `TypeORMSalonRepository`, `salon.di.ts`
- [x] 4.3 Create use cases: `CreateSalonUseCase`, `ListSalonesUseCase`, `GetSalonByApiKeyUseCase`
- [x] 4.4 Create presentation: `SalonSuperadminController`, `SalonN8nController`, `superadmin.routes.ts`, `n8n.routes.ts`

## Phase 5: Core Middleware

- [x] 5.1 Create `authGuard.ts` (JWT Bearer extraction + verification)
- [x] 5.2 Create `apiKeyGuard.ts` (X-API-Key validation for n8n routes)
- [x] 5.3 Create `tenantGuard.ts` (salonId injection from JWT or API key)
- [x] 5.4 Create `requireRole.ts` (role-based guard factory)
- [x] 5.5 Create `validate.ts` (Zod validation middleware)
- [x] 5.6 Create `errorHandler.ts` (global Express error handler)
- [x] 5.7 Create `requestLogger.ts` (async Bitacora audit writer)

## Phase 6: Backend Assembly

- [x] 6.1 Create `app.ts` with middleware chain (helmet → cors → json → requestLogger → health → n8n routes → auth routes → superadmin routes → errorHandler)
- [x] 6.2 Create `server.ts` entry point (listen on PORT, initialize DataSource, run seed)
- [x] 6.3 Wire DI container with all registered interfaces and implementations

## Phase 7: Frontend Scaffolds

- [x] 7.1 Create `apps/superadmin/` (Vite + React): package.json, vite.config.ts, tsconfig, index.html, main.tsx, App.tsx, api.ts, ProtectedRoute, LoginPage, DashboardPage, SalonListPage, CreateSalonPage, globals.css
- [x] 7.2 Create `apps/pos-dashboard/` (Vite + React): package.json, vite.config.ts, tsconfig, index.html, main.tsx, App.tsx, api.ts, ProtectedRoute, LoginPage, DashboardPage, globals.css

## Phase 8: Tests

- [x] 8.1 `LoginUseCase.test.ts`: valid creds → tokens, wrong pw → 401, inactive → 401
- [x] 8.2 `AuthController.test.ts`: POST /auth/login → 200, 401, GET /auth/me → 200
- [x] 8.3 `CreateSalonUseCase.test.ts`: salon created with dueña via mock repo
- [x] 8.4 `SalonController.test.ts`: POST + GET /superadmin/salones return 201 and 200
- [x] 8.5 `authGuard.test.ts`: missing token → 401, expired → 401, valid → next()
- [x] 8.6 `validate.test.ts`: valid body → next(), invalid → 400
- [x] 8.7 `errorHandler.test.ts`: AppError → structured JSON, unknown → 500 generic
- [x] 8.8 Health check test (GET /api/salud returns status+timestamp)

## Phase 9: Root Verification

- [x] 9.1 Run `npm install` at root — all workspace deps resolve
- [x] 9.2 Run `npx tsc --noEmit` — all packages and apps compile with strict TS (apps/api, apps/superadmin, apps/pos-dashboard)
- [x] 9.3 Run `npx vitest run` in apps/api — 8 test files, 32 tests pass
- [x] 9.4 Docker: `docker compose config` validates successfully
- [ ] 9.5 ESLint: not configured per-app, skipped for this phase
- [ ] 9.6 Live seed verification: requires running MySQL and server

## Dependency Graph

```
Phase 1 (Foundation) ────────────────────────────┐
                                                  │
Phase 2 (Database Layer) ← depends on 1.1─1.3 ───┤
                                                  │
Phase 3 (Auth Module) ← depends on 2.1─2.3, 2.6 ─┤
                                                  │
Phase 4 (Salon Module) ← depends on 2.1─2.3 ─────┤
                                                  │
Phase 5 (Middleware) ← depends on 2.1─2.2 ───────┤
                                                  │
Phase 6 (Assembly) ← depends on Phases 3, 4, 5 ──┤
                                                  │
Phase 7 (Frontends) ← depends on 1.4─1.6 ────────┤
                                                  │
Phase 8 (Tests) ← depends on Phases 3, 4, 5, 6 ──┤
                                                  │
Phase 9 (Verify) ← depends on all phases ─────────┘
```

**Parallelism note**: Phases 3, 4, 5 can be worked in parallel after Phase 2 completes. Phase 7 can start after Phase 1.

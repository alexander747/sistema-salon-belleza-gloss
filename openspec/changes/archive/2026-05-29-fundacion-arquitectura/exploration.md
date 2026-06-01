# Exploration: Fundación Arquitectónica — pos-final

## Executive Summary

Este cambio establece la fundación arquitectónica de **pos-final**, un multi-tenant SaaS para salones de belleza que migra progresivamente desde el prototipo **pos-ok**. La arquitectura target es un monorepo (Turborepo) con backend hexagonal (Node/TS/Express/TypeORM/MySQL), dos frontends independientes (Superadmin Portal + POS Dashboard) compartiendo un UI kit, sin WhatsApp en backend (delegado a n8n), JWT auth, Zod validation, tsyringe DI, Vitest testing, audit log, structured logging, y un modelo de datos multi-tenant heredado de pos-ok con mejoras.

---

## Current State Analysis (pos-ok)

### What Works Well (keep these patterns)

| Aspect | Details |
|--------|---------|
| **Entity Model** | Las 19 entidades capturan fielmente el dominio del negocio. Comentarios detallados en español con reglas de negocio. Relaciones y enums bien definidos. |
| **Multi-tenancy by salonId** | Aislado por `salonId` en cada entidad. El concepto de tenant ya está presente. |
| **n8n Endpoint Pattern** | Controladores dedicados para n8n que exponen endpoints de consulta/operación para el agente IA externo. |
| **Frontend Routing** | React Router v6 con layout anidado. Estructura de páginas clara y modular. |
| **Enums & States** | Todos los estados de negocio bien capturados como enums (EstadoCita, TipoInventario, MetodoPago, TipoBloqueo, etc.). |

### What Needs Rewriting

| Aspect | Problem | Solution |
|--------|---------|----------|
| **No layers** | `controllers/` acceden directo a TypeORM repo. Sin servicios, sin repositorios, sin casos de uso. | Hexagonal architecture con capas domain/application/infrastructure/presentation. |
| **No dependency injection** | Cada controller instancia `AppDataSource.getRepository()` directamente. | tsyringe DI con contenedor. |
| **No auth** | No hay JWT, middleware, ni protección de rutas. | JWT con refresh tokens, middleware de roles, protección por endpoint. |
| **No validation** | No hay Zod ni schema validation. | Zod schemas para request/response. |
| **No error handling middleware** | Try/catch en cada controlador con res.status(500). | Error middleware centralizado con clases de error tipadas. |
| **No testing** | Cero tests. package.json no tiene test runner. | Vitest + Supertest para tests unitarios e integración. |
| **WhatsApp (Baileys) in backend** | `@whiskeysockets/baileys`, `qrcode-terminal` en backend. Manejo de sesiones WS. | Eliminar completamente. WhatsApp delegado a n8n. |
| **n8n endpoints sin auth** | `/api/n8n/:salonId/*` expuesto sin API Key. | API Key header obligatorio para rutas n8n. |
| **Flat frontend** | Un solo frontend. Sin Superadmin Portal. No hay ui-kit compartido. | Dos frontends + ui-kit package. |
| **synchronize: true** | TypeORM con auto-sync en vez de migraciones. | Migraciones formales. |
| **Console.log** | Logging con console.log/error esporádico. | Structured logging (pino o winston). |
| **Sin audit log** | No hay registro de operaciones. | Bitácora con HTTP method, URL, request/response. |

### Entity Migration Map

| # | Entity | Status | Notes |
|---|--------|--------|-------|
| 1 | `Salon` | **Transfers** | Agregar: `estado` (ACTIVO/SUSPENDIDO), `plan` (BASIC/PREMIUM), campo para API Key n8n. |
| 2 | `Usuario` | **Changes** | Roles actuales son booleanos → migrar a enum `Rol` (SUPERADMIN, DUENIA, ADMINISTRADOR, RECEPCIONISTA, MANICURISTA, CONTADOR). Agregar `passwordHash` (ya existe), `refreshToken`. |
| 3 | `Cliente` | **Transfers** | Sin cambios significativos. |
| 4 | `CategoriaServicio` | **Transfers** | Sin cambios. |
| 5 | `Servicio` | **Transfers** | Sin cambios. |
| 6 | `Producto` | **Transfers** | Sin cambios. |
| 7 | `Cita` | **Transfers** | Sin cambios. |
| 8 | `RegistroServicio` | **Transfers** | Sin cambios. Es la transacción central. |
| 9 | `PagoTransaccion` | **Transfers** | Sin cambios. |
| 10 | `Liquidacion` | **Transfers** | Sin cambios. |
| 11 | `Gasto` | **Transfers** | Sin cambios. |
| 12 | `HorarioComercial` | **Transfers** | Sin cambios. |
| 13 | `BloqueoAgenda` | **Transfers** | Sin cambios. |
| 14 | `FotoPortafolio` | **Transfers** | Sin cambios. |
| 15 | `CampanaMarketing` | **Transfers** | Sin cambios. |
| 16 | `Notificacion` | **Transfers** | Sin cambios. |
| 17 | `Devolucion` | **Transfers** | Sin cambios. |
| 18 | `DivisionRegistro` | **Transfers** | Sin cambios. |
| 19 | `RecompensaFidelidad` | **Transfers** | Sin cambios. |
| — | **Bitacora (Audit Log)** | **NEW** | Nueva entidad: HTTP method, URL, request body, response body, usuarioId, timestamp. |
| — | **RefreshToken** | **NEW** | Nueva entidad/columna para manejo de sesiones JWT. |

**WhatsApp-related entities to REMOVE**: No hay entidades específicas de WhatsApp en pos-ok (Baileys se manejaba en los controladores `botControlador` y `whatsappControlador`). Las rutas `/api/bot/`, `/api/salones/:salonId/whatsapp/` y las dependencias `@whiskeysockets/baileys`, `qrcode-terminal` se eliminan del proyecto.

---

## Target Architecture

### Monorepo Structure (Turborepo)

```
pos-final/
├── package.json                    # Root workspace config
├── turbo.json                      # Turborepo pipeline
├── tsconfig.base.json              # Shared TS config
├── .eslintrc.js                    # Shared lint rules
├── .prettierrc                     # Shared formatting
├── packages/
│   ├── shared-types/               # @pos/shared-types
│   │   ├── package.json
│   │   └── src/
│   │       ├── entities/           # Domain entity interfaces (agnostic)
│   │       ├── enums/              # Shared enums (Rol, EstadoCita, MetodoPago...)
│   │       └── dtos/               # Request/Response DTOs
│   └── ui-kit/                     # @pos/ui-kit
│       ├── package.json
│       └── src/
│           ├── components/         # Base components (Button, Input, Modal, Table...)
│           ├── hooks/              # Shared hooks (useAuth, useSalon...)
│           ├── layouts/            # Base layouts
│           └── styles/             # Design tokens, CSS variables, theme
├── apps/
│   ├── backend/                    # Express API server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts            # Entry point
│   │       ├── server.ts           # App setup (express instance)
│   │       └── modules/           # Hexagonal modules
│   │           ├── shared/         # Cross-cutting: errors, middleware, logger
│   │           └── {domain}/       # One folder per bounded context
│   └── dashboard/                  # POS Dashboard (React + Vite)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── pages/
│   │       ├── features/           # Feature-based modules
│   │       └── services/           # API client
│   └── superadmin/                 # Superadmin Portal (React + Vite)
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           ├── pages/
│           ├── features/
│           └── services/
└── docker-compose.yml              # MySQL + n8n + app services
```

### Backend Hexagonal Layers (per module)

```
src/modules/{domain}/
├── domain/
│   ├── entities/                   # TypeORM entities (or plain domain models)
│   ├── enums/                      # Domain enums
│   └── ports/                      # Interfaces for repositories / services
│       ├── I{Entity}Repository.ts
│       └── I{Service}.ts
├── application/
│   ├── use-cases/                  # Business logic orchestration
│   │   └── {Action}UseCase.ts
│   └── dto/                        # Input/Output DTOs with Zod schemas
│       └── {Action}Dto.ts
├── infrastructure/
│   ├── persistence/                # TypeORM implementations of ports
│   │   └── TypeOrm{Entity}Repository.ts
│   ├── di/                         # tsyringe registrations
│   │   └── {module}DiRegistry.ts
│   └── http/                       # Express-specific concerns
│       └── {module}Router.ts
└── presentation/
    └── controllers/                # Express request handlers (thin)
        └── {module}Controller.ts
```

**Bounded Contexts (initial modules)**:

| Module | Domain | Entities |
|--------|--------|----------|
| `salon` | Tenant management | Salon |
| `auth` | Authentication & authorization | — (JWT logic) |
| `usuarios` | Staff & roles | Usuario |
| `clientes` | Customer management | Cliente |
| `catalogo` | Services catalog | CategoriaServicio, Servicio, FotoPortafolio |
| `inventario` | Product inventory | Producto, Devolucion |
| `citas` | Appointment scheduling | Cita, HorarioComercial, BloqueoAgenda |
| `ventas` | Transactions & payments | RegistroServicio, PagoTransaccion, DivisionRegistro |
| `finanzas` | Payroll, expenses, ROI | Liquidacion, Gasto |
| `marketing` | Campaigns & loyalty | CampanaMarketing, RecompensaFidelidad, Notificacion |
| `n8n` | External AI agent API | — (thin controllers with API Key) |
| `audit` | Bitácora | Bitacora |

### Cross-Cutting Infrastructure

| Concern | Implementation |
|---------|---------------|
| **Error handling** | `AppError` class hierarchy + global error middleware |
| **Logging** | Pino logger (structured JSON) |
| **Validation** | Zod schemas per endpoint + validation middleware |
| **Auth** | JWT (access + refresh tokens) + role-based guard middleware |
| **DI** | tsyringe container |
| **Testing** | Vitest + Supertest |
| **ORM** | TypeORM with migrations (`synchronize: false` in prod) |
| **Config** | dotenv + zod-validated config schema |

### Frontend Architecture (both apps)

```
apps/{app}/src/
├── App.tsx                         # Router setup
├── main.tsx                        # Entry + providers (AuthProvider, QueryProvider)
├── pages/                          # Route-level components
│   ├── Login/
│   ├── Dashboard/
│   └── ...
├── features/                       # Feature modules
│   └── {feature}/
│       ├── components/
│       ├── hooks/
│       └── services/               # API calls
├── services/                       # HTTP client (axios instance)
├── hooks/                          # Global hooks
├── providers/                      # Context providers
└── styles/                         # Global styles + theme
```

**Shared UI Kit** (`packages/ui-kit`):
- Atomic design: atoms → molecules → organisms
- Design tokens (CSS custom properties)
- Base components: Button, Input, Select, Modal, Table, Card, Badge, Toast, Spinner, Avatar
- Layout components: Sidebar, Header, PageContainer
- All components accept className for composition

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Scope creep** — querer migrar todo de golpe | High | High | Initialización progresiva: primero backend fundacional, luego migrar módulos uno por uno |
| **Baileys removal breaks WhatsApp** | Medium | High | Asegurar que n8n workflow esté operativo ANTES de eliminar Baileys. Deploy de n8n docker-compose como paso temprano |
| **Data model changes (Usuario roles)** bloquean frontend | Medium | Medium | Migrar entidades en lote 1, adaptar frontend en lote 2 |
| **Sin experiencia con hexagonal** | Medium | Medium | Documentar claramente cada capa. Usar ejemplos concretos del primer módulo (auth o salones) |
| **Turborepo learning curve** | Low | Low | Config inicial simple. Turborepo se puede agregar después si npm workspaces puro es suficiente |
| **Testing desde cero** | Medium | Medium | Vitest config desde el día 1. Tests para casos de uso críticos (auth, cálculos de comisión) |
| **JWT + refresh token complexity** | Low | Medium | Usar patrón probado. Biblioteca `jsonwebtoken` + middleware simple |

---

## Recommendations

### Project Initialization Order

```
Phase 0: Scaffolding (this change)
├── Monorepo setup (root package.json, turbo.json, tsconfig.base.json)
├── Create packages/ directory with shared-types (stub)
├── Create apps/backend skeleton with hexagonal folder structure
├── Create apps/dashboard skeleton (React + Vite)
├── Create apps/superadmin skeleton (React + Vite)
├── packages/ui-kit skeleton
├── TypeORM config + DataSource with migration mode
├── Vitest + Supertest setup
├── Pino logger setup
├── Docker compose with MySQL + n8n
└── ESLint + Prettier config

Phase 1: Auth & Tenant Foundation
├── Auth module (JWT, login, refresh, middleware)
├── Salon entity migration + CRUD
├── Usuario entity migration with Rol enum
├── Superadmin: login + salon management UI
├── Superadmin: user management UI
└── n8n API key generation per salon

Phase 2: Core Business Modules (migrate from pos-ok)
├── Módulo catálogo (CategoriaServicio + Servicio)
├── Módulo clientes
├── Módulo inventario (Producto)
├── Módulo citas (Cita + Horario + Bloqueos)
├── Módulo ventas (RegistroServicio + Pagos)
└── POS Dashboard: pages for each module

Phase 3: Finance & Business Intelligence
├── Módulo finanzas (Liquidacion + Gasto + ROI)
├── Módulo marketing (CampanaMarketing)
├── Módulo fidelización (RecompensaFidelidad)
├── nómina UI en dashboard
└── Reportes financieros

Phase 4: n8n Integration & AI
├── n8n routes with API Key auth
├── Audit log (Bitacora)
├── Docker compose for n8n
└── n8n workflow setup (load n8n-workflow-bot.json from pos-ok)
```

### First Steps (right after this exploration)

1. Run `npm init -w` or Turborepo `create-turbo` to scaffold the monorepo
2. Set up `packages/shared-types` with the entity interfaces and enums
3. Set up `apps/backend` with Express + TypeORM + Vitest
4. Implement the **Auth module** first (JWT + middleware) — it's the foundation everything else depends on
5. Implement the **Salon module** as the first business module (simplest, establishes hexagonal patterns)
6. Implement **Bitacora** (audit log) as middleware from day 1 — add it before writing any real business logic
7. Set up n8n docker-compose early so WhatsApp integration path is clear

---

## Decision Points (need confirmation)

1. **Turborepo vs. npm workspaces puro** — Turborepo da caching y pipeline, pero npm workspaces puro es más simple. Recomiendo **Turborepo** (más escalable, especialmente con 3 apps + 2 packages).
2. **pnpm vs npm** — pnpm es más rápido y eficiente en monorepos. Sugiero **pnpm** si el equipo está cómodo.
3. **Orden de migración de módulos** — ¿Empezamos con auth + catálogo (que es simple) o con ventas (que es el core)?
4. **TypeORM vs Drizzle/Knex** — Sugiero mantener TypeORM para no reescribir entities. Discutible si queremos cambiar.
5. **¿Backend monolítico vs separado por módulo?** — Sugiero monolítico con módulos hexagonales para la Fase 1. Separación física en microservicios sería premature optimization.
6. **Dashboard UI framework** — Sugiero mantener React puro + CSS modules o Tailwind CSS. No agregar librerías de componentes pesadas (MUI, AntD) para mantener el bundle liviano.

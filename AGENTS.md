# AGENTS.md — POS Final

Monorepo for a salon SaaS management system. Hexagonal architecture (Clean Architecture) on the backend, React+Vite on the frontend.

## Quick start

```bash
nvm use 22                    # .nvmrc says 20, but v22 is the installed LTS
docker compose up -d           # MySQL on 3307, n8n on 5678
cd apps/api && npx tsx src/infrastructure/persistence/seed.ts  # must run first
bash start.sh                  # or start each service manually
```

**Services:**
| Service | Port | Command |
|---------|------|---------|
| API | 3001 | `cd apps/api && npx tsx src/server.ts` |
| Dashboard | 5174 | `cd apps/pos-dashboard && npx vite --port 5174 --host` |
| Superadmin | 5173 | `cd apps/superadmin && npx vite --port 5173 --host` |

**Test credentials:** `duena@test.com` / `duena123` (dashboard), `eder@gmail.com` / `Eder123` (superadmin).

## Architecture

```
apps/
  api/               Express + TypeORM + tsyringe (hexagonal: modules/{domain,application,infrastructure,presentation})
  pos-dashboard/     React + Vite + framer-motion (salon owner dashboard)
  superadmin/        React + Vite (cross-tenant admin)
packages/
  types/             Shared TypeScript interfaces
  validation/        Zod schemas for API payloads
  ui/                Shared React components (Layout, Button, Card, Skeleton, etc.)
  config/            Shared config
```

The API uses **tsyringe** for DI (`container.ts`). Modules follow: `domain/ports/` → interfaces, `infrastructure/persistence/` → TypeORM repos, `application/use-cases/` → business logic, `presentation/controllers/` + `routes/` → HTTP layer.

## Critical gotchas

### ESM import hoisting breaks dotenv
`import` declarations are hoisted above code. If a module reads `process.env` at the top level (like `new DataSource({ port: process.env.DB_PORT })`), `dotenv.config()` runs **after** that import resolves. **Always use dynamic imports** after `dotenv.config()` in entrypoints (`server.ts`, `seed.ts`).

```ts
// ❌ dotenv runs too late
import 'dotenv/config';
import { AppDataSource } from './shared/database';

// ✅ dynamic import after dotenv
import dotenv from 'dotenv';
dotenv.config({ path: '...' });
const { AppDataSource } = await import('./shared/database');
```

### Validation package needs rebuild
`packages/validation/` has a `dist/` directory. The API imports from `dist/`, NOT the `.ts` source. After any schema change:
```bash
cd packages/validation && npx tsc
```
Then restart the API.

### API field naming mismatches
The API DTOs use flat IDs and specific field names. Frontend interfaces often expect different shapes. **Always read the backend DTO** before assuming frontend fields:

| Frontend expects | API returns |
|-----------------|-------------|
| `precio` | `precioBase` (services) |
| `fecha` + `horaInicio` | `fechaHora` (single ISO string) |
| `cliente: { nombre }` | `clienteId: number` |
| `empleada: { nombre }` | `usuarioId: number` |
| `total` | `montoTotal` |
| `metodoPago` | `pagos[0].metodoPago` |
| `duracionTotal` | `duracionTotalMinutos` |

**Fix:** Add a transformation layer in `fetchCitas`/`fetchData` that maps API fields to frontend interfaces.

### Timezone trap
Never construct ISO dates with string concatenation + `Z`:
```ts
// ❌ "08:00.000Z" = 08:00 UTC ≠ 08:00 local
fechaHora: `${fecha}T${horaInicio}:00.000Z`

// ✅ Browser converts local time to correct UTC
fechaHora: new Date(`${fecha}T${horaInicio}:00`).toISOString()
```

### Horarios comerciales (business hours)
The salon has **no working hours by default** — all days are closed. Configure them via `PUT /salones/:id/agenda/horarios` or slots will always be empty.

### Slots API
- Endpoint: `GET /salones/:id/agenda/disponibilidad/slots?fecha=&usuarioId=&duracionMinutos=`
- Returns `[{hora: "08:00", disponible: true}]`, **not** `string[]`
- The `duracionMinutos` param is mandatory; `serviciosIds` is NOT a valid param

### Agenda status flow
Valid estados: `PENDIENTE` → `CONFIRMADA` → `COMPLETADA`. There is **no** `EN_PROGRESO` state. The API validation schema only accepts: `CONFIRMADA, CANCELADA, COMPLETADA, NO_LLEGO`.

### Pagination
Use `apps/api/src/shared/pagination.ts` — `PaginatedResult<T>` with `paginate()`. Query params: `page` (default 1), `limit` (default 0 = all). Frontend uses 12 per page. Already implemented for: registros, gastos, devoluciones.

### DB_PORT is 3307
MySQL is exposed on port **3307** (not the default 3306). The `.env` in `apps/api/` must match.

## Common workflows

### Debugging a cita creation flow
1. Check horarios are configured (otherwise slots return `[]`)
2. Check `fechaHora` uses `new Date().toISOString()`, not string concat
3. Check `duracionMinutos` is sent, not `serviciosIds`
4. Check frontend fetches `precioBase` from API, not `precio`

### Adding a new endpoint with pagination
1. Add `skip?`/`take?` to repository `search()` interface and implementation
2. Add `count()` method with same filters
3. Update use case to accept `page`/`limit`, compute skip, call `paginate()`
4. Update controller to validate `paginationSchema` from `@pos-final/validation`
5. Return `PaginatedResult<DTO>` — the response shape is `{ data: [...], meta: { page, limit, total, totalPages } }`

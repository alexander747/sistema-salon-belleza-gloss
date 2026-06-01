## Exploration: CRUD Personas (Empleadas + Clientes)

### Current State

**Empleadas (UsuarioEntity)** — entity exists at `apps/api/src/infrastructure/persistence/entities/UsuarioEntity.ts` with all required fields:
- Identity: `nombre`, `numeroWhatsApp`, `email`, `passwordHash`, `avatar`, `fechaNacimiento`
- Authorization: `rol` (enum Rol: SUPERADMIN=1, DUEÑA=2, ADMINISTRADOR=3, MANICURISTA=4, RECEPCIONISTA=5, CONTADOR=6)
- Compensation: `porcentajeComisionServicio` (decimal 5,2), `sueldoFijo` (decimal 12,2), `bonoHorario` (decimal 12,2), `frecuenciaBono` (varchar 20)
- Soft-delete: `activo` (boolean, default true)
- Tenant: `salonId` (FK to SalonEntity)
- Base: `id`, `creadoEn`, `actualizadoEn` via BaseEntity

**Clientes (ClienteEntity)** — entity exists with all required fields:
- Identity: `nombre`, `telefono`, `email`, `fechaNacimiento`
- Commerce: `puntajeConfianza` (default 100), `cantidadNoShows`, `puntosFidelidad`, `totalServicios`, `ultimaVisita`, `deudaTotal`, `servicioFrecuente`
- Soft-delete: `activo` (boolean, default true)
- Tenant: `salonId` (FK to SalonEntity)

**What exists vs needs to be built:**

| Layer | Empleadas | Clientes |
|-------|-----------|----------|
| Entity | ✅ UsuarioEntity exists | ✅ ClienteEntity exists |
| Repository Port | ⚠️ IUsuarioRepository exists (auth module) but MISSING: `findBySalon`, `softDelete`, `list`, `count` | ❌ IClienteRepository — must create from scratch |
| Repository Impl | ⚠️ TypeORMUsuarioRepository exists but MISSING: `findBySalon`, `softDelete`, `list` | ❌ TypeORMClienteRepository — must create |
| Use Cases | ❌ Must create: List, Get, Create, Update, ToggleActivo | ❌ Must create: List, Get, Create, Update, SearchByPhone |
| Controllers / Routes | ❌ Must create | ❌ Must create |
| DTOs | ❌ Must create (or reuse IUser shape with explicit fields) | ❌ Must create |
| Validation Schemas | ⚠️ `createUsuarioSchema` exists in auth.schema.ts — but it bundles auth+compensation. Need separate empleada-specific schema | ❌ Must create |
| Frontend Pages | ❌ Must create | ❌ Must create |
| DI Registration | ❌ Not registered | ❌ Not registered |

### Affected Areas

| Path | Why affected |
|------|-------------|
| `apps/api/src/modules/auth/domain/ports/IUsuarioRepository.ts` | Extend with `findBySalon`, `softDelete`, `list` methods for empleadas module |
| `apps/api/src/modules/auth/infrastructure/repositories/TypeORMUsuarioRepository.ts` | Implement new methods |
| `apps/api/src/modules/personas/` | **New module** — hexagonal layers (empleadas/ + clientes/) |
| `apps/api/src/shared/container.ts` | Register new repositories, use cases, controllers |
| `apps/api/src/app.ts` | Mount new personas routes |
| `packages/validation/src/` | Add `personas.schema.ts` with empleada + cliente validation schemas |
| `packages/validation/src/index.ts` | Export new schemas |
| `packages/types/src/` | Possible update: export `ICliente` type interface |
| `apps/pos-dashboard/src/App.tsx` | Add routes for `/empleadas`, `/clientes` |
| `apps/pos-dashboard/src/pages/` | New `EmpleadasPage.tsx`, `ClientesPage.tsx` |

### Use Case Inventory

#### Empleadas (5 use cases)

| Use Case | Input | Output | Auth | Notes |
|----------|-------|--------|------|-------|
| `ListEmpleadasUseCase` | salonId, filter? (rol, activo) | EmpleadaDto[] | DUEÑA, ADMIN | Only active by default; can include inactive for dueña |
| `GetEmpleadaUseCase` | salonId, id | EmpleadaDto | DUEÑA, ADMIN, or self | Own profile access for any empleada |
| `CreateEmpleadaUseCase` | salonId, nombre, numeroWhatsApp, email, password?, rol, compensación fields | EmpleadaDto | DUEÑA, ADMIN | Hash password if provided; validate unique phone/email per salon; validate rol ≤ ADMIN (can't create SUPERADMIN) |
| `UpdateEmpleadaUseCase` | salonId, id, partial fields | EmpleadaDto | DUEÑA, ADMIN | Don't touch passwordHash if password not provided; validate role change constraints |
| `ToggleEmpleadaActivoUseCase` | salonId, id | EmpleadaDto | DUEÑA, ADMIN | Soft-delete/restore. Warn: can't deactivate self |

#### Clientes (6 use cases)

| Use Case | Input | Output | Auth | Notes |
|----------|-------|--------|------|-------|
| `ListClientesUseCase` | salonId, search?, page?, limit? | ClienteDto[] + pagination meta | RECEPCIONISTA+, MANICURISTA (view) | Search by nombre or telefono |
| `GetClienteUseCase` | salonId, id | ClienteDto | RECEPCIONISTA+, MANICURISTA (view) | Returns full profile including deuda, loyalty metrics |
| `CreateClienteUseCase` | salonId, nombre, telefono, email?, fechaNacimiento? | ClienteDto | RECEPCIONISTA+ | Validate unique phone per salon; n8n may create with minimal fields |
| `UpdateClienteUseCase` | salonId, id, partial fields | ClienteDto | RECEPCIONISTA+ | Salon-scoped |
| `SearchClienteByPhoneUseCase` | salonId, telefono | ClienteDto | n8n, RECEPCIONISTA+ | Used by n8n bot for WhatsApp lookups; returns null if not found (no error) |
| `FindOrCreateClienteUseCase` | salonId, telefono, nombre? | ClienteDto | n8n | n8n-specific: search by phone, create if not found with minimal data |

### Business Logic & Validation

#### Empleadas
1. **Password handling**: Create → hash with bcrypt. Update → only rehash if `password` field is present; otherwise preserve existing `passwordHash`. Never return passwordHash in DTO.
2. **Unique constraints**: `numeroWhatsApp` and `email` must be unique **within the salon** (global check at DB level optional, but at minimum salon-scoped). WhatsApp number is especially critical — used for n8n bot identification.
3. **Role creation rules**: Only DUEÑA can create/update users with rol ≥ ADMINISTRADOR. ADMINISTRADOR can create MANICURISTA, RECEPCIONISTA, CONTADOR but not another ADMIN or DUEÑA.
4. **Self-deactivation guard**: Cannot deactivate (activo=false) yourself.
5. **Compensation field visibility**: `porcentajeComisionServicio`, `sueldoFijo`, `bonoHorario`, `frecuenciaBono` — only visible to DUEÑA/ADMIN in list/get responses; other roles see these as null/undefined.
6. **frecuenciaBono valid values**: `'semanal'`, `'quincenal'`, `'mensual'`, or null/undefined.

#### Clientes
1. **Phone uniqueness**: `telefono` must be unique per salon. Used by n8n as the lookup key.
2. **puntajeConfianza**: Starts at 100, decremented by `cantidadNoShows`. Business rule: each no-show reduces confidence by 20 points? (Needs confirmation — could be configurable).
3. **deudaTotal**: Read-only computed field from transactions. Not manually editable.
4. **puntosFidelidad / totalServicios / ultimaVisita**: Auto-updated from service registrations, not directly editable.
5. **n8n creation**: Minimal fields required (telefono + nombre). Other fields (email, fechaNacimiento) optional and set later via frontend.

### Architecture Decision: Module Structure

**Recommendation**: Single `modules/personas/` module with two sub-directories:

```
modules/personas/
├── domain/
│   ├── ports/
│   │   ├── IClienteRepository.ts       # NEW
│   │   └── IEmpleadaRepository.ts      # NEW (alternative: extend auth IUsuarioRepository)
│   └── entities/                       # Empty — reuse existing entities
├── application/
│   ├── dtos/
│   │   ├── EmpleadaDTO.ts
│   │   └── ClienteDTO.ts
│   └── use-cases/
│       ├── empleadas/
│       │   ├── ListEmpleadasUseCase.ts
│       │   ├── GetEmpleadaUseCase.ts
│       │   ├── CreateEmpleadaUseCase.ts
│       │   ├── UpdateEmpleadaUseCase.ts
│       │   └── ToggleEmpleadaActivoUseCase.ts
│       └── clientes/
│           ├── ListClientesUseCase.ts
│           ├── GetClienteUseCase.ts
│           ├── CreateClienteUseCase.ts
│           ├── UpdateClienteUseCase.ts
│           ├── SearchClienteByPhoneUseCase.ts
│           └── FindOrCreateClienteUseCase.ts
├── infrastructure/
│   └── persistence/
│       ├── TypeORMEmpleadaRepository.ts   # Implements IEmpleadaRepository
│       └── TypeORMClienteRepository.ts    # Implements IClienteRepository
└── presentation/
    ├── controllers/
    │   ├── EmpleadaController.ts
    │   └── ClienteController.ts
    └── routes/
        └── personas.routes.ts
```

**Design Decision**: Create `IEmpleadaRepository` as a new port (not extending auth's `IUsuarioRepository`) to avoid cross-module coupling. The auth module owns `IUsuarioRepository` for login/refresh flows. The personas module owns `IEmpleadaRepository` for CRUD. Both can use `TypeORMUsuarioRepository` or separate implementations under the hood.

Alternative: Add missing methods to auth's `IUsuarioRepository`. Less code duplication but tighter coupling. **Chosen: new ports for personas module** — cleaner separation.

### Frontend Pages

| Page | Route | Features | Access |
|------|-------|----------|--------|
| **Empleadas** | `/dashboard/empleadas` | Table (nombre, WhatsApp, rol, activo badge). Create/Edit modal with fields (compensation section toggled by role). Toggle active/inactive. Search by name/phone. | DUEÑA, ADMIN |
| **Clientes** | `/dashboard/clientes` | Table (nombre, teléfono, deuda badge, puntajeConfianza). Create/Edit modal. Search by phone. Click row → detail view (loyalty, history placeholder). | RECEPCIONISTA+, MANICURISTA (view only) |

### Endpoint Design

```
# Empleadas — scoped to salon
GET    /api/salones/:salonId/empleadas          → List (filter: ?rol=&activo=)
GET    /api/salones/:salonId/empleadas/:id      → Get one (or own profile shortcut: /api/empleadas/me)
POST   /api/salones/:salonId/empleadas          → Create
PUT    /api/salones/:salonId/empleadas/:id      → Update
PATCH  /api/salones/:salonId/empleadas/:id/activar → Toggle active

# Clientes — scoped to salon
GET    /api/salones/:salonId/clientes                     → List (?search=&page=&limit=)
GET    /api/salones/:salonId/clientes/:id                 → Get one
GET    /api/salones/:salonId/clientes/search/:telefono    → Search by phone (for n8n)
POST   /api/salones/:salonId/clientes                     → Create
PUT    /api/salones/:salonId/clientes/:id                 → Update
POST   /api/salones/:salonId/clientes/find-or-create      → n8n: find by phone or create minimal
```

### Roles & Permissions Matrix

| Operation | SUPERADMIN | DUEÑA | ADMIN | MANICURISTA | RECEPCIONISTA | CONTADOR |
|-----------|-----------|-------|-------|-------------|---------------|----------|
| List Empleadas | ✅ | ✅ | ✅ | ❌ self only | ❌ self only | ❌ |
| Get Empleada (any) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Get Empleada (self) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Empleada | ✅ | ✅ | ⚠️ (≤ADMIN) | ❌ | ❌ | ❌ |
| Update Empleada | ✅ | ✅ | ⚠️ (≤ADMIN) | ❌ | ❌ | ❌ |
| Toggle activo | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| List Clientes | ✅ | ✅ | ✅ | ✅ (view) | ✅ | ❌ |
| Get Cliente | ✅ | ✅ | ✅ | ✅ (view) | ✅ | ❌ |
| Create Cliente | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Update Cliente | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

### Risks

1. **Cross-module repository coupling** — Empleada CRUD needs UsuarioEntity. The auth module already owns `IUsuarioRepository`. If we add methods to it, the auth module's interface grows beyond its responsibility. Creating a separate `IEmpleadaRepository` duplicates the findById/findByEmail/findByPhone methods. **Mitigation**: Accept the small duplication — it's cleaner than coupling the modules.

2. **Password security on update** — The `createUsuarioSchema` already has optional `password`. For update, the schema must NOT include `password` by default, or must explicitly handle `undefined` to avoid overwriting the hash. **Mitigation**: Update use case checks `input.password !== undefined` before calling bcrypt. The update schema excludes passwordHash entirely; a separate `changePassword` endpoint could handle password changes.

3. **Role escalation** — An ADMINISTRADOR could create another ADMINISTRADOR or higher, which is a security risk. **Mitigation**: Business logic in Create/Update use cases: `currentUser.rol < input.rol` check — only DUEÑA or above can assign ADMIN+ roles. Also prevent changing your own role.

4. **Unique phone/email enforcement** — WhatsApp number is the key identifier for n8n. If duplicates exist, bot behavior breaks. **Mitigation**: Add database unique constraints per salon, or add business logic validation in use cases. Index on `(salonId, numeroWhatsApp)` and `(salonId, email)`.

5. **Self-deactivation loophole** — An admin could deactivate themselves, losing system access. **Mitigation**: `ToggleEmpleadaActivoUseCase` checks `targetId !== currentUserId` when deactivating.

6. **Compensation field exposure** — Manicuristas should NOT see other employees' compensation data in list/get responses. **Mitigation**: DTO layer strips compensation fields for non-DUEÑA/ADMIN roles.

7. **n8n FindOrCreate race condition** — If n8n fires concurrent requests for the same new phone number, two clients could be created. **Mitigation**: Unique index on `(salonId, telefono)` in the database. The FindOrCreate use case can use a transaction with `INSERT ... ON DUPLICATE KEY UPDATE`.

8. **puntajeConfianza manual vs automatic** — Should this be auto-calculated from `cantidadNoShows` or manually editable? **Decision needed**: If auto, it's read-only in the DTO. If manual, needs explicit field in update schema.

### Effort Estimate

| Area | Files | Complexity | Est. Time |
|------|-------|-----------|-----------|
| Backend — ports + repos | ~6 files (2 ports, 2 repos, 2 DI updates) | Medium | 1-2h |
| Backend — use cases | 11 files | Medium-High | 2-3h |
| Backend — controllers + routes | 3 files | Low | 30min |
| Backend — validation schemas | 1-2 files | Low-Medium | 30min |
| Frontend — Empleadas page | 1-2 files | Medium | 1-2h |
| Frontend — Clientes page | 1-2 files | Medium | 1-2h |
| Frontend — routes + nav | 1-2 files | Low | 15min |
| **Total** | **~20-25 files** | **Medium** | **~6-10h** |

### Delivery Strategy

- **Review budget**: ~600-800 lines estimated (significant new module).
- **Decision needed before apply**: No — the exploration is clear.
- **Chained PRs recommended**: Yes — split into 2 PRs:
  1. **PR1**: Backend infrastructure + empleadas (ports, repos, use cases, controllers, routes, schemas, DI) — ~350-400 lines
  2. **PR2**: Clientes backend + all frontend — ~300-400 lines
- **400-line budget risk**: High for a single PR. Chaining is recommended.

### Ready for Proposal

Yes. The exploration is complete — entities exist, use cases are inventoried, roles are defined, unknowns are flagged, and the delivery strategy is clear. The orchestrator should present this to the user to confirm the split (one `personas` module vs two modules), the permission matrix, and the auto-calculation of `puntajeConfianza` before proceeding to proposal.

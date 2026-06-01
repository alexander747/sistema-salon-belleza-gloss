# Design: CRUD Personas (Empleadas + Clientes)

## Technical Approach

Single `personas` module following the existing catalogo hexagonal pattern: domain ports → use-cases → DTOs → controllers → routes. Empleadas reuse `UsuarioEntity`; clientes reuse `ClienteEntity`. Both entities already exist with TypeORM mappings. No new tables required.

Two sub-domains under one module because they share the `salonId` tenant-scoping pattern. Separate controllers, use-cases, and repositories per sub-domain — same structure as `catalogo/servicio` vs `catalogo/producto`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Same token `IUsuarioRepository` as auth | DI collision; personas needs salon-scoped `findBySalon` | New token `IPersonasUsuarioRepository` |
| Reuse auth's `TypeORMUsuarioRepository` | Auth repo lacks salon-scoped queries | New `TypeORMUsuarioRepository` inside personas module |
| Strip compensation in use-case vs DTO | Use-case: logic scattered. DTO: single transform point | DTO static factory `EmpleadaDTO.fromEntity(entity, userRol)` |
| Merge routes into catalogoRouter | SRP violation; catalogo != personas | New `personasRouter` with `mergeParams: true`, mounted separately |
| Hashing in controller vs use-case | Controller: thin. Use-case: business logic | `CreateEmpleadaUseCase` and `UpdateEmpleadaUseCase` inject `IBcryptService` |

## Data Flow

```
     req.user.rol          req.salonId
         │                      │
   ┌─────▼──────┐      ┌───────▼────────┐
   │  Controller │─────▶│   Use Case     │────▶ DTO.fromEntity(entity, rol)
   │  extracts   │      │  orchestrates  │          │
   │  params     │      │  repo + hash   │    strips compensation
   └────────────┘      └───────┬────────┘    if !DUEÑA && !ADMIN
                               │
                        ┌──────▼──────┐
                        │  Repository │
                        │  (salon-    │
                        │   scoped)   │
                        └─────────────┘
```

Role filtering for EmpleadaDTO: `if (userRol !== Rol.DUEÑA && userRol !== Rol.ADMINISTRADOR)` → null compensation fields in response.

Duplicate phone for clientes: `CreateClienteUseCase` → `repo.findBySalonAndTelefono()` → if found, return existing with HTTP 200 (not 201). For empleadas: same check returns 409.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/personas/domain/ports/IUsuarioRepository.ts` | Create | Salon-scoped queries: `findBySalon`, `findBySalonAndId`, `findBySalonAndPhone`, `create`, `update`, `updateActivo` |
| `apps/api/src/modules/personas/domain/ports/IClienteRepository.ts` | Create | Salon-scoped: `findBySalon(tel?)`, `findBySalonAndId`, `findBySalonAndTelefono`, `create`, `update` |
| `apps/api/src/modules/personas/application/dtos/EmpleadaDTO.ts` | Create | `fromEntity(entity, userRol)` — strips compensation for non-DUEÑA/non-ADMIN |
| `apps/api/src/modules/personas/application/dtos/ClienteDTO.ts` | Create | `fromEntity(entity)` — straight mapping |
| `apps/api/src/modules/personas/application/use-cases/empleada/ListEmpleadasUseCase.ts` | Create | `findBySalon(salonId, rol?, activo?)` → DTOs |
| `apps/api/src/modules/personas/application/use-cases/empleada/GetEmpleadaUseCase.ts` | Create | `findBySalonAndId` → DTO with rol filter |
| `apps/api/src/modules/personas/application/use-cases/empleada/CreateEmpleadaUseCase.ts` | Create | Hash password via `IBcryptService`, insert, return 201. Duplicate phone → 409 |
| `apps/api/src/modules/personas/application/use-cases/empleada/UpdateEmpleadaUseCase.ts` | Create | Hash password if provided; partial merge |
| `apps/api/src/modules/personas/application/use-cases/empleada/ActivateEmpleadaUseCase.ts` | Create | `updateActivo(id, true)` |
| `apps/api/src/modules/personas/application/use-cases/empleada/DeactivateEmpleadaUseCase.ts` | Create | Guard `reqUserId !== targetId` → 422; else `updateActivo(id, false)` |
| `apps/api/src/modules/personas/application/use-cases/cliente/ListClientesUseCase.ts` | Create | `findBySalon(salonId, telefono?)` |
| `apps/api/src/modules/personas/application/use-cases/cliente/GetClienteUseCase.ts` | Create | `findBySalonAndId` |
| `apps/api/src/modules/personas/application/use-cases/cliente/CreateClienteUseCase.ts` | Create | Duplicate phone → return existing with 200; else create with `activo: true`, `puntajeConfianza: 100` |
| `apps/api/src/modules/personas/application/use-cases/cliente/UpdateClienteUseCase.ts` | Create | Partial update |
| `apps/api/src/modules/personas/infrastructure/persistence/TypeORMUsuarioRepository.ts` | Create | Implements `IPersonasUsuarioRepository` via salon-join queries |
| `apps/api/src/modules/personas/infrastructure/persistence/TypeORMClienteRepository.ts` | Create | Implements `IClienteRepository` |
| `apps/api/src/modules/personas/presentation/controllers/EmpleadaController.ts` | Create | 6 route handlers, inject use-cases via DI |
| `apps/api/src/modules/personas/presentation/controllers/ClienteController.ts` | Create | 4 route handlers |
| `apps/api/src/modules/personas/presentation/routes/personas.routes.ts` | Create | All routes with `mergeParams: true`, role guards |
| `packages/validation/src/personas.schema.ts` | Create | Zod schemas: `createEmpleada`, `updateEmpleada`, `createCliente`, `updateCliente` |
| `packages/validation/src/index.ts` | Modify | Export new schemas and types |
| `apps/api/src/shared/container.ts` | Modify | Register 2 repos, 10 use-cases, 2 controllers (≈24 lines) |
| `apps/api/src/app.ts` | Modify | Mount `personasRouter` under `/api/salones/:salonId` (1 line) |

## Interfaces / Contracts

```typescript
// IUsuarioRepository (personas)
interface IUsuarioRepository {
  findBySalon(salonId: number, rol?: Rol, activo?: boolean): Promise<UsuarioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<UsuarioEntity | null>;
  findBySalonAndPhone(salonId: number, phone: string): Promise<UsuarioEntity | null>;
  create(data: Partial<UsuarioEntity>): Promise<UsuarioEntity>;
  update(id: number, data: Partial<UsuarioEntity>): Promise<UsuarioEntity | null>;
  updateActivo(id: number, activo: boolean): Promise<boolean>;
}

// IClienteRepository (personas)
interface IClienteRepository {
  findBySalon(salonId: number, telefono?: string): Promise<ClienteEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ClienteEntity | null>;
  findBySalonAndTelefono(salonId: number, telefono: string): Promise<ClienteEntity | null>;
  create(data: Partial<ClienteEntity>): Promise<ClienteEntity>;
  update(id: number, data: Partial<ClienteEntity>): Promise<ClienteEntity | null>;
}
```

DI tokens: `'IPersonasUsuarioRepository'`, `'IClienteRepository'`. Use-cases registered as class tokens (e.g. `ListEmpleadasUseCase`), following catalogo convention.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | DTO role filtering, password hashing calls, self-deactivation guard | Jest, mock repos |
| Integration | Repository salon-scoped queries, duplicate phone detection | Jest + test DB |
| E2E | Full route cycle with auth + tenant guards, role-based 403s | Supertest |

## Migration / Rollout

No migration required. Existing entities (`usuarios`, `clientes`) unchanged. Rollout: deploy new module code, register routes — no data migration.

## Implementation Order

1. Domain ports (2 interfaces)
2. Validation schemas (`packages/validation/src/personas.schema.ts`)
3. DTOs (EmpleadaDTO, ClienteDTO)
4. Infrastructure repositories (TypeORMUsuarioRepository, TypeORMClienteRepository)
5. Use cases (10 total: 6 empleada + 4 cliente)
6. Controllers (EmpleadaController, ClienteController)
7. Routes (`personas.routes.ts`)
8. DI container registrations (`container.ts`)
9. Mount router in `app.ts`

## Open Questions

None.

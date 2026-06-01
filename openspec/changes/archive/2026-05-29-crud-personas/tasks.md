# Tasks: CRUD Personas (Empleadas + Clientes)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,043 |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Infra + Empleadas) → PR 2 (Clientes + Tests) |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base | Lines |
|------|------|-----------|------|-------|
| 1 | Ports + schemas + DTOs + repos + 6 empleada use cases + controller + route handlers | PR 1 | main | ~550 |
| 2 | 4 cliente use cases + controller + route handlers + container + app.ts + all tests | PR 2 | main or PR 1 | ~493 |

## Phase 1: Foundation

- [x] 1.1 Create `personas/domain/ports/IUsuarioRepository.ts` — 6 salon-scoped methods
- [x] 1.2 Create `personas/domain/ports/IClienteRepository.ts` — 5 salon-scoped methods
- [x] 1.3 Create `personas.schema.ts` in validation pkg — 4 Zod schemas
- [x] 1.4 Export new schemas and types from `validation/src/index.ts`

## Phase 2: DTOs + Repositories

- [x] 2.1 Create `EmpleadaDTO.ts` — `fromEntity(entity, userRol)` strips compensation for non-DUEÑA/non-ADMIN
- [x] 2.2 Create `ClienteDTO.ts` — `fromEntity(entity)` straight mapping _(PR #2)_
- [x] 2.3 Create `TypeORMUsuarioRepository.ts` — implements IPersonasUsuarioRepository
- [x] 2.4 Create `TypeORMClienteRepository.ts` — implements IClienteRepository

## Phase 3: Empleadas Use Cases

- [x] 3.1 `ListEmpleadasUseCase` — salon-scoped with rol/activo filters
- [x] 3.2 `GetEmpleadaUseCase` — find by salon+id, rol-filtered DTO
- [x] 3.3 `CreateEmpleadaUseCase` — hash password, duplicate phone → 409
- [x] 3.4 `UpdateEmpleadaUseCase` — partial, re-hash if password provided
- [x] 3.5 `ActivateEmpleadaUseCase` — set activo=true
- [x] 3.6 `DeactivateEmpleadaUseCase` — self-deactivation guard → 422

## Phase 4: Clientes Use Cases

- [x] 4.1 `ListClientesUseCase` — salon-scoped, optional phone search
- [x] 4.2 `GetClienteUseCase` — find by salon+id
- [x] 4.3 `CreateClienteUseCase` — duplicate phone → return existing with 200
- [x] 4.4 `UpdateClienteUseCase` — partial update

## Phase 5: Controllers + Routes + Wiring

- [x] 5.1 Create `EmpleadaController.ts` — 6 handlers
- [x] 5.2 Create `ClienteController.ts` — 4 handlers _(PR #2)_
- [x] 5.3 Create `personas.routes.ts` — all routes, mergeParams, role guards
- [x] 5.4 Register 2 repos + 10 use-cases + 2 controllers in `container.ts`
- [x] 5.5 Mount `personasRouter` in `app.ts` under `/api/salones/:salonId`

## Phase 6: Tests

- [x] 6.1 Unit: DTO strips compensation for non-DUEÑA/non-ADMIN
- [x] 6.2 Unit: CreateEmpleadaUseCase calls bcrypt, duplicate phone → 409
- [x] 6.3 Unit: DeactivateEmpleadaUseCase rejects self-deactivation (422)
- [x] 6.4 Unit: CreateClienteUseCase duplicate phone → 200 + existing entity
- [ ] 6.5 Integration: Repository salon-scoped queries + duplicate detection
- [ ] 6.6 E2E: Full route cycle with auth, tenant isolation, role-based 403s

# Proposal: Completar Cita Atómico

## Intent

Completing a cita makes TWO frontend calls: `POST /registros` then `POST /citas/:id/completar`. If the second fails (state machine rejects COMPLETADA — PENDIENTE only allows [CONFIRMADA, CANCELADA] — or network error), the registro is already committed; retry creates ANOTHER. Observed: 9 duplicate registros for one cita. Fix: ONE backend transaction creating registro AND completing cita, or persisting nothing. Retry must not duplicate.

## Scope

### In Scope
- `CompletarCitaUseCase` combined: optional `registro?`; one shared queryRunner
- `CreateRegistroUseCase.execute(input, queryRunner?)` — absent = own-tx (backward compatible)
- `ICitaRepository.cambiarEstado(id, estado, extraData?, queryRunner?)` + TypeORM impl
- Route gains `validate(completarCitaSchema)`; response `{ cita, registro }`
- Migration: nullable `citaId` + passthrough (go-forward linkage)
- Frontend AgendaPage: ONE call, payload under `registro`; delete POST /registros

### Out of Scope
- Deterministic idempotency key (documented follow-up)
- WalkInModal / VentasPage (already single POST)
- State-machine relaxation (PENDIENTE→COMPLETADA stays invalid — by design)

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `agenda-citas`: `POST /citas/:id/completar` becomes atomic — optional `{registro}` created in the same transaction; response `{ cita, registro }`; all validations (caja, cliente, usuario, state machine) run before any write.

## Approach

**Option A (owner-approved):** `CompletarCitaUseCase` opens ONE queryRunner. Validate first (caja abierta vs `cita.salonId` — never client-supplied; cliente/usuario; state transition→422). Then `createRegistro(registro, qr)` → `citaRepo.cambiarEstado(..., qr)` → `commit` → re-fetch DTOs after commit → `release`. Legacy path (no `registro`): unchanged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/.../CompletarCitaUseCase.ts` | Modify | Atomic combined flow |
| `apps/api/.../registro/CreateRegistroUseCase.ts` | Modify | Optional `queryRunner?` param |
| `apps/api/.../ICitaRepository.ts` + TypeORM impl | Modify | `queryRunner?` passthrough |
| `apps/api/.../CitaController.ts` + `agenda.routes.ts` | Modify | Pass `registro`; add validate |
| `packages/validation/src/finanzas.schema.ts` + `index.ts` | Modify | `completarCitaSchema` export |
| `apps/api/.../RegistroServicioEntity.ts` | Modify | `citaId` column |
| `apps/api/.../migrations/1700000000013-AddCitaIdRegistros.ts` | New | Add nullable citaId |
| `apps/pos-dashboard/src/pages/AgendaPage.tsx` | Modify | Single call, nested payload |
| Tests: CompletarCita, CitaController, CreateRegistro | Modify | Atomic scenarios |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale validation `dist/` breaks API | Med | Rebuild package + restart API |
| Read-after-write in tx → stale DTO | Med | Re-fetch AFTER commit, default repos |
| Response shape change | Low | Frontend ignores body today |
| Cross-module DI (agenda→finanzas) | Low | `CreateRegistroUseCase` class-token registered |

## Rollback Plan

1. Revert code (use case, repo, routes, frontend) — API returns to two-call behavior.
2. Migration `down` drops nullable `citaId` — additive, no data loss.
3. Existing duplicates NOT auto-cleaned; manual SQL cleanup separate.

## Dependencies

- `cd packages/validation && npx tsc` (API imports `dist/`)
- Migration `1700000000013` runs before deploy
- `docker compose up -d` for local verification

## Success Criteria

- [ ] Completar = exactly ONE POST; retry after success → 422, NO duplicate registro
- [ ] PENDIENTE completar and caja cerrada → error AND zero rows persisted
- [ ] Registros created via completar carry `citaId`
- [ ] `POST /completar` without body keeps legacy behavior
- [ ] All existing finanzas/agenda tests pass

# Tasks: Guardar detalle de servicios en registros financieros

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 400–550 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: entity, migration, schema, DTOs, use case, repository | PR 1 | Single PR — changes are tightly coupled |

## Phase 1: RED — Write failing tests first (TDD)

- [x] 1.1 `finanzas.schema.test.ts` — [RED] Add tests for `serviciosItems` validation (valid items, invalid items, empty/missing)
- [x] 1.2 `RegistroServicioItemDTO.test.ts` — [RED] Create with test for entity-to-DTO mapper (snapshot columns)
- [x] 1.3 `CreateRegistroUseCase.test.ts` — [RED] Add test: `serviciosItems` are persisted in transaction; add test: empty `serviciosItems` → no rows

## Phase 2: GREEN — Make tests pass (validation + backend core)

- [x] 2.1 `packages/validation/src/finanzas.schema.ts` — Add `serviciosItems` array to `createRegistroSchema` (optional, default `[]`, each item: `servicioId positive int`, `nombreServicio max 200`, `precioServicio min 0`)
- [x] 2.2 `apps/api/src/infrastructure/persistence/entities/RegistroServicioItemEntity.ts` — Create entity mirroring `RegistroProductoEntity`: FK `registroServicioId`, snapshot columns `servicioId`, `nombreServicio`, `precioServicio`
- [x] 2.3 `apps/api/src/infrastructure/persistence/entities/RegistroServicioEntity.ts` — Add `@OneToMany(() => RegistroServicioItemEntity, si => si.registroServicio) serviciosItems`
- [x] 2.4 `apps/api/src/infrastructure/persistence/migrations/1700000000007-CreateRegistroServicioItem.ts` — Create migration for `registros_servicio_items` (FK → `registros_servicio(id)` CASCADE)
- [x] 2.5 `apps/api/src/modules/finanzas/application/dtos/RegistroServicioItemDTO.ts` — Create DTO + `registroServicioItemToDTO()` mapper
- [x] 2.6 `apps/api/src/modules/finanzas/application/dtos/RegistroServicioDTO.ts` — Add `serviciosItems: RegistroServicioItemDTO[]` to interface + map in `registroServicioToDTO()`
- [x] 2.7 `apps/api/src/modules/finanzas/application/use-cases/registro/CreateRegistroUseCase.ts` — Add step 6: persist `serviciosItems` via `queryRunner.manager.getRepository(RegistroServicioItemEntity)` inside transaction (after products step 10 / before commit)
- [x] 2.8 `apps/api/src/modules/finanzas/infrastructure/persistence/TypeORMRegistroServicioRepository.ts` — Add `.leftJoinAndSelect('r.serviciosItems', 'si')` in `findById()` and `search()`
- [x] 2.9 Run `npx vitest run` — confirm all RED tests now pass (schema, DTO, use case)

## Phase 3: GREEN — Frontend payload + display

- [x] 3.1 `apps/pos-dashboard/src/components/WalkInModal.tsx` — Add `serviciosItems: cart.map(...)` to `handleSubmit` payload (map `CartItem` → `{ servicioId, nombreServicio: nombre, precioServicio: precio }`)
- [x] 3.2 `apps/pos-dashboard/src/pages/AgendaPage.tsx` — Add `serviciosItems[]` to completar cita payload (from the selected services list when completing)
- [x] 3.3 `apps/pos-dashboard/src/pages/FinanzasPage.tsx` — Add `serviciosItems: ServicioItemDTO[]` to `Registro` interface + render items in `RenderRegistroDetail` (below the "Servicio" card, matching the `productosVendidos` mini-card pattern)
- [x] 3.4 Run `npx tsc --noEmit` in both frontend apps — confirm type checks pass

## Phase 4: REFACTOR — Polish and verify

- [x] 4.1 Run `npx vitest run` — full test suite green
- [ ] 4.2 Manual verification: create registro via WalkInModal with 2+ services, verify detail modal shows items
- [ ] 4.3 Manual verification: completar cita from agenda, verify items persisted in DB query

## Dependency Graph

```
1.1─┐      ┌─2.1 (schema)
1.2─┤──►2.2─►2.5 (DTO)
1.3─┤      └─2.7 (use case)
    2.2────►2.3──►2.4 (entity→entity→migration)
    2.5────►2.6 (DTO→RegistroServicioDTO)
    2.7────►2.8 (use case→repo)
           3.1──►3.2 (frontend payloads)
            3.3 (frontend display)
```

## Verification Command

```bash
cd apps/api && npx vitest run
cd apps/pos-dashboard && npx tsc --noEmit
cd packages/validation && npx tsc
```

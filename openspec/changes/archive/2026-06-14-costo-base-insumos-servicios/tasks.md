# Tasks: Costo base/insumos por servicio para cálculo de comisión

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~205 |
| 400-line budget risk | Low |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation (Entities + Migration + DTOs + Schema)

- [x] 1.1 **Add `costoBaseInsumos` column to `ServicioEntity`** — Add `@Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) costoBaseInsumos: number` to `apps/api/src/infrastructure/persistence/entities/ServicioEntity.ts`
- [x] 1.2 **Add `costoBaseInsumos` column to `RegistroServicioItemEntity`** — Same column in `apps/api/src/infrastructure/persistence/entities/RegistroServicioItemEntity.ts`
- [x] 1.3 **Create migration `1700000000008-AddCostoBaseInsumos.ts`** — `ALTER TABLE servicios ADD costo_base_insumos DECIMAL(12,2) NOT NULL DEFAULT 0` + same for `registros_servicio_items`. New file in `apps/api/src/infrastructure/persistence/migrations/`
- [x] 1.4 **Add `costoBaseInsumos` to `ServicioDTO.fromEntity`** — Field + mapping `Number(entity.costoBaseInsumos ?? 0)` in `apps/api/src/modules/catalogo/application/dtos/ServicioDTO.ts`
- [x] 1.5 **Add `costoBaseInsumos` to `RegistroServicioItemDTO`** — Field in interface + `costoBaseInsumos: Number(entity.costoBaseInsumos)` in mapper at `apps/api/src/modules/finanzas/application/dtos/RegistroServicioItemDTO.ts`
- [x] 1.6 **Add `costoBaseInsumos` to `catalogo.schema.ts`** — `costoBaseInsumos: z.number().min(0).default(0).optional()` in `createServicioSchema`; `updateServicioSchema` inherits via `.partial()`
- [x] 1.7 **Add `costoBaseInsumos` to `finanzas.schema.ts`** — `costoBaseInsumos: z.number().min(0).default(0).optional()` in the serviciosItems[] item inside `createRegistroSchema`

## Phase 2: Core Logic (Service + Use Cases)

- [x] 2.1 **Update `ComisionService.calcularComision` signature** — Add `totalCostoBaseInsumos: number = 0` param, formula `(totalServicios - totalCostoBaseInsumos) * (porcentajeComision / 100)`, return 0 if negative. File: `apps/api/src/modules/finanzas/application/services/ComisionService.ts`
  - **TDD**: Write test cases (scenarios 1-6 from spec) FIRST before modifying implementation
- [x] 2.2 **Update `ComisionService.test.ts`** — Add 6 new `it()` cases covering: insumos deducción, legacy no-insumos, negative guard, total 0, porcentaje 0, rounding. File: `apps/api/src/modules/finanzas/application/services/__tests__/ComisionService.test.ts`
- [x] 2.3 **Update `CreateServicioUseCase`** — Add `costoBaseInsumos?: number` to input interface and pass to `this.servicioRepo.create()`. File: `apps/api/src/modules/catalogo/application/use-cases/servicio/CreateServicioUseCase.ts`
- [x] 2.4 **Update `UpdateServicioUseCase`** — Add `costoBaseInsumos?: number` to input interface and to the `data` object passed to `this.servicioRepo.update()`. File: `apps/api/src/modules/catalogo/application/use-cases/servicio/UpdateServicioUseCase.ts`
- [x] 2.5 **Update `CreateRegistroUseCase.execute`** — Compute `totalCostoBaseInsumos = reduce sum of si.costoBaseInsumos`, pass as 3rd arg to `calcularComision()`, save `costoBaseInsumos: si.costoBaseInsumos ?? 0` when creating items. File: `apps/api/src/modules/finanzas/application/use-cases/registro/CreateRegistroUseCase.ts`
- [x] 2.6 **Update `CreateRegistroUseCase.test.ts`** — Add `costoBaseInsumos` to mock RegistroServicioItemEntity, add test verifying comisionCalculada = (total - totalCostoBaseInsumos) * porcentaje. File: same directory, `__tests__/CreateRegistroUseCase.test.ts`

## Phase 3: Frontend (Interfaces + Forms + Payloads)

- [x] 3.1 **Add `costoBaseInsumos` to frontend `Servicio` interface** — `costoBaseInsumos?: number` in `apps/pos-dashboard/src/services/servicioService.ts`
- [x] 3.2 **Add `costoBaseInsumos` field to ServiciosPage form** — Form state default `0`, input field with label "Costo base insumos", include in both POST/PUT payload, set in `openEdit` from `svc.costoBaseInsumos ?? 0`. File: `apps/pos-dashboard/src/pages/ServiciosPage.tsx`
- [x] 3.3 **Update WalkInModal — CartItem and payload** — Add `costoBaseInsumos?: number` to `CartItem` interface, include when `addToCart` is called, send in `serviciosItems` payload. File: `apps/pos-dashboard/src/components/WalkInModal.tsx`
- [x] 3.4 **Update AgendaPage — ServicioSimple and completar payload** — Add `costoBaseInsumos?: number` to `ServicioSimple`, include in both original and extra servicios items in `handleConfirmarCompletar`. File: `apps/pos-dashboard/src/pages/AgendaPage.tsx`

## Phase 4: Verification

- [x] 4.1 **Run validation package build** — `cd packages/validation && npx tsc` to rebuild dist after schema changes
- [x] 4.2 **Run API tests** — `cd apps/api && npx vitest run` — all existing + new tests must pass
- [x] 4.3 **Run frontend type check** — `cd apps/pos-dashboard && npx tsc --noEmit` — verify no type errors
- [x] 4.4 **Run superadmin type check** — `cd apps/superadmin && npx tsc --noEmit` — ensure shared Servicio interface type consistency

## Implementation Order

Phase 1 → Phase 2 → Phase 3 → Phase 4. Within Phase 1, DTOs and schemas are independent from entities/migration. ComisionService change (2.1) is the key dependency for Phase 3 — frontend payloads depend on the schema and DTOs but not on ComisionService directly.

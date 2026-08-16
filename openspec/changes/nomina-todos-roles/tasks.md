# Tasks: Nómina para Todos los Roles

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: 2 use cases + tests | PR 1 | API-first, base main |
| 2 | Frontend: MIXTO + test | PR 1 | Mismo PR — ~450 líneas < 800 |

## Phase 1: Backend — RED (tests)

- [x] 1.1 Crear `apps/api/src/modules/finanzas/application/use-cases/liquidacion/__tests__/NominaPendienteUseCase.test.ts` (fakes de IUsuarioRepository/IRegistroServicioRepository/ILiquidacionRepository con `as never`): manicurista incluida (pasa), solo-sueldo incluido (falla), CONTADOR excluido (falla), DUEÑA con config incluida (falla), DUEÑA 0/0 excluida (falla), ya-liquidada skip (pasa)
- [x] 1.2 Crear `__tests__/LiquidarEmpleadaUseCase.test.ts` con mock `shared/database.js` (queryRunner.manager.getRepository, patrón CreateRegistroUseCase.test.ts): fijo-solo liquida 201 (falla), 0 registros+0 fijo lanza 4xx (pasa), doble-pago tras liquidación previa lanza (pasa)

## Phase 2: Backend — GREEN

- [x] 2.1 `NominaPendienteUseCase.ts` L37-41: `findBySalon(input.salonId, undefined, true)` (omitir `Rol.MANICURISTA`)
- [x] 2.2 `NominaPendienteUseCase.ts`: al inicio del loop, `if (empleada.rol === Rol.CONTADOR) continue;`
- [x] 2.3 `NominaPendienteUseCase.ts` L60-62: skip → `if (pendingRegistros.length === 0 && Number(empleada.sueldoFijo) <= 0 && Number(empleada.bonoHorario) <= 0) continue;` — conservar guard de ya-liquidada (L64-81)
- [x] 2.4 `LiquidarEmpleadaUseCase.ts` L67-69: `if (pendingRegistros.length === 0 && Number(empleada.sueldoFijo) <= 0 && Number(empleada.bonoHorario) <= 0) throw new UnprocessableEntityError(...)`
- [x] 2.5 Verificar: `cd apps/api && npx tsc --noEmit && npx vitest run`

## Phase 3: Frontend — modo MIXTO

- [x] 3.1 `EmpleadasPage.tsx` L36: `tipoPago: 'COMISION' | 'FIJO' | 'MIXTO'`
- [x] 3.2 `openEdit` L227: MIXTO si `sueldoFijo > 0 && porcentajeComisionServicio > 0`
- [x] 3.3 `buildPayload` L250-251: MIXTO setea ambos campos; COMISION/FIJO anulan el otro (ver Design §Interfaces)
- [x] 3.4 UI L873-918: tercer toggle "Mixto"; en MIXTO mostrar inputs de porcentaje Y sueldoFijo; columna Pago de la tabla muestra ambos si MIXTO
- [x] 3.5 Crear `apps/pos-dashboard/src/pages/__tests__/EmpleadasPage.test.tsx` (patrón FinanzasPage.test.tsx, api mock): MIXTO → payload con ambos campos; COMISION → sueldoFijo=0
- [x] 3.6 Verificar: `cd apps/pos-dashboard && npx vitest run`

## Phase 4: Verificación

- [x] 4.1 `cd apps/api && npx vitest run --coverage` (≥ 80%, verify.threshold)
- [x] 4.2 Manual: `GET /finanzas/nomina` muestra recepcionista/admin/dueña (sin contador); liquidar sueldo-fijo-solo → 201; doble pago bloqueado; MIXTO persiste en edición

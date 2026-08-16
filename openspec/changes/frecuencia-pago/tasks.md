# Tasks: Frecuencia de Pago por Empleada (MENSUAL/QUINCENAL)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~80 · PR2 ~420 |
| 400-line budget risk | Medium (PR2) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Cuentas UX) → PR 2 (frecuenciaPago) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Badge "Al día" + orden en CuentasTab Pagar | PR 1 | Base main; solo FinanzasPage.tsx + test; independiente |
| 2 | frecuenciaPago end-to-end (API+form+nómina) | PR 2 | Base main; depende de nada de PR1; migración+rebuild |

## Phase 1: PR1 — Cuentas UX (Work Unit 1)

- [ ] 1.1 `FinanzasPage.tsx` CuentasTab Pagar (L4552-4567): badge verde "Al día" si `e.pendienteActual === 0`
- [ ] 1.2 Ordenar `pagar` client-side: pendientes primero (por empleadaId), al día al final — tras `loadPagar`
- [ ] 1.3 `FinanzasPage.test.tsx`: assert badge en fila Sofía (pendienteActual 0) y orden DOM (María antes) — fixture L452-455

## Phase 2: PR2 — Fundación API

- [ ] 2.1 `packages/types/src/user.ts`: `FrecuenciaPago` union + `frecuenciaPago?` en IUser
- [ ] 2.2 Crear `migrations/1700000000012-AddFrecuenciaPagoToUsuarios.ts`: `ALTER TABLE usuarios ADD frecuenciaPago VARCHAR(20) NOT NULL DEFAULT 'MENSUAL'`; down = DROP COLUMN
- [ ] 2.3 `UsuarioEntity.ts`: columna `frecuenciaPago` (varchar 20, default 'MENSUAL')
- [ ] 2.4 `personas.schema.ts`: create `z.enum(['MENSUAL','QUINCENAL']).default('MENSUAL')`; update `.optional()`; **`cd packages/validation && npx tsc`**
- [ ] 2.5 Create/UpdateEmpleadaUseCase: input `frecuenciaPago` + paso al repo (patrón frecuenciaBono L55/L59)
- [ ] 2.6 `EmpleadaDTO.ts`: `frecuenciaPago` bajo máscara DUEÑA/ADMIN (L36-46), null para otros

## Phase 3: PR2 — Lógica de nómina

- [ ] 3.1 `NominaPendienteUseCase.ts`: helper período por empleada (colombia-date.ts) — MENSUAL 1→hoy byte-idéntico; QUINCENAL 1-15/16-fin
- [ ] 3.2 Factor comp fijo: QUINCENAL 0.5 en `totalAPagar`; exponer `periodoInicio`, `periodoFin`, `frecuenciaPago` en `NominaPendienteEmpleada`
- [ ] 3.3 Guard L76-92: `findBySalonEmpleadaAndPeriodo` con período de la empleada; filtro de registros por período SOLO en QUINCENAL
- [ ] 3.4 `LiquidarEmpleadaUseCase.ts` L111-113: factor 0.5 sobre sueldoFijo/bonoHorario registrados

## Phase 4: PR2 — Frontend

- [ ] 4.1 `EmpleadasPage.tsx`: select "Frecuencia de pago" (aria-label) tras Esquema de Pago (L906); `EMPTY_FORM` 'MENSUAL'; buildPayload (L248-266); openEdit precarga (L219-239)
- [ ] 4.2 Badge frecuencia en columna Pago (L679-687) — texto "MENSUAL"/"QUINCENAL"
- [ ] 4.3 `FinanzasPage.tsx`: `NominaEmpleado` +3 campos; card "Período {frec} · inicio → fin" (L2738); handleLiquidar (L2475-2482) usa `emp.periodoInicio`/`emp.periodoFin`

## Phase 5: PR2 — Tests (RED→GREEN)

- [ ] 5.1 `NominaPendienteUseCase.test.ts`: `vi.useFakeTimers()`+`setSystemTime` — QUINCENAL 10/08→[1,15], 20/08→[16,31], MENSUAL 10/08→[1,10]; assert período al guard
- [ ] 5.2 Factor: QUINCENAL sueldoFijo=200000+bono=50000 → totalAPagar=125000; LiquidarEmpleada registra 100000/25000
- [ ] 5.3 `EmpleadasPage.test.tsx` L64: `getByRole('combobox')` → `getByLabelText('Frecuencia de pago')`; assert payload QUINCENAL y default MENSUAL
- [ ] 5.4 `LiquidarEmpleadaUseCase.test.ts`: caso quincenal 50%
- [ ] 5.5 Suites: `cd apps/api && npx vitest run`, `cd apps/pos-dashboard && npx vitest run`

## Phase 6: Verificación

- [ ] 6.1 Tests existentes de NominaPendiente pasan sin edición (MENSUAL byte-idéntico)
- [ ] 6.2 Typecheck: `cd apps/api && npx tsc --noEmit` + dashboard
- [ ] 6.3 Flujo manual: crear empleada QUINCENAL → nomina período+50% → liquidar → CuentasTab badge

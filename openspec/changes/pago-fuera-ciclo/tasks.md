# Tasks: Pago Fuera de Ciclo (SEMANAL + período editable)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250-320 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | SEMANAL end-to-end + modal período editable (tipos → backend → frontend → tests) | PR 1 (único) | Base main; sin migración; rebuild validation; MENSUAL/QUINCENAL byte-idénticos |

## Phase 1: Tipos y validación

- [x] 1.1 `packages/types/src/user.ts` L12: `FrecuenciaPago = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL'`
- [x] 1.2 `packages/validation/src/personas.schema.ts` L23+L43: `z.enum(['MENSUAL','QUINCENAL','SEMANAL'])`; **`cd packages/validation && npx tsc`** (rebuild dist)
- [x] 1.3 `personas.schema.test.ts`: `'SEMANAL'` aceptado en create y update; `'ANUAL'` → 422

## Phase 2: Backend — nómina

- [x] 2.1 `NominaPendienteUseCase.ts` `calcularPeriodo`: rama SEMANAL — lunes de la semana actual (`(getUTCDay()+6)%7` sobre `hoy+12:00Z`) → domingo; `colombiaDayStartUTC/colombiaDayEndUTC`
- [x] 2.2 `NominaPendienteUseCase.ts`: `FACTOR_FIJO_SEMANAL = 0.25` (junto a L32); factor L155: SEMANAL→0.25, QUINCENAL→0.5, MENSUAL→1
- [x] 2.3 `NominaPendienteUseCase.ts` L110: filtro de registros por período también para SEMANAL (`QUINCENAL || SEMANAL`)
- [x] 2.4 `LiquidarEmpleadaUseCase.ts` L114: `factorFijo` → 0.25 si SEMANAL (mantener 0.5 QUINCENAL / 1 MENSUAL)

## Phase 3: Frontend

- [x] 3.1 `EmpleadasPage.tsx` L41: tipo `frecuenciaPago` +`'SEMANAL'`; L239 openEdit: passthrough de los 3 valores (no mapear no-QUINCENAL → MENSUAL); L928: `<option value="SEMANAL">Semanal</option>`
- [x] 3.2 `FinanzasPage.tsx`: estado `periodoAuditarDesde`/`periodoAuditarHasta` (cerca de L2350-2358)
- [x] 3.3 `handleAuditar` (L2528): inicializar ambos del row (`emp.periodoInicio`/`periodoFin`); reemplazar filtro `getCurrentPeriod()` (L2566) por rango editado (mantener `estaPagadaEmpleada !== false`)
- [x] 3.4 Header modal (L3128-3132): inputs `type="date"` Desde/Hasta con default = período del row (formato `YYYY-MM-DD` en día Colombia)
- [x] 3.5 Totales del modal (L3210-3227): `useMemo` recalcula comisiones/propinas desde `auditarRegistros` filtrados; bono+sueldo del row
- [x] 3.6 `handleConfirmLiquidar` (L2595-2600): pasar `periodoAuditarDesde/Hasta` (ISO `T05:00:00.000Z`, fin = día inclusive +1) en lugar de `selectedEmpleada.periodoInicio/periodoFin`
- [x] 3.7 Aviso de solapamiento: si el rango editado intersecta una liquidación de `historial` (mismo `usuarioId`) → warning en el modal (comp fijo podría pagarse de nuevo)

## Phase 4: Tests

- [x] 4.1 `NominaPendienteUseCase.test.ts`: SEMANAL jueves 13/08/2026 → [10,16] y factor 25% (200000+50000 → totalAPagar 62500); lunes 17/08 → [17,23]; registro fuera de semana excluido; guard consulta la semana
- [x] 4.2 `LiquidarEmpleadaUseCase.test.ts`: SEMANAL registra sueldoFijo=50000 / bonoHorario=12500
- [x] 4.3 `EmpleadasPage.test.tsx`: opción "Semanal" visible; payload `SEMANAL` al crear; openEdit precarga SEMANAL
- [x] 4.4 `FinanzasPage.test.tsx`: auditoría precarga inputs con período del row; cambiar Hasta re-filtra el detalle; confirmar → POST `/liquidar` con período editado; aviso al solapar historial
- [x] 4.5 Regresión: suites API + dashboard completas (`npx vitest run` en `apps/api` y `apps/pos-dashboard`)

## Phase 5: Verificación

- [x] 5.1 Typecheck: `cd apps/api && npx tsc --noEmit` y dashboard
- [ ] 5.2 Flujo manual: crear empleada SEMANAL → nómina muestra semana + 25% → auditoría con período editado → liquidar

# Proposal: Pago Fuera de Ciclo (SEMANAL + período editable)

## Intent

La frecuencia de pago es una regla, no una camisa de fuerza: una empleada puede pedir que le paguen HOY sin que sea mes, quincena o semana. El sistema debe seguir funcionando igual, pero el período al liquidar pasa a ser OPCIONAL (editable). Además se agrega la frecuencia `SEMANAL`. NO se quita nada de lo ya construido — la frecuencia solo calcula el período por defecto; el pago fuera de ciclo es una excepción manual permitida.

## Scope

### In Scope
- `SEMANAL` en `FrecuenciaPago`: período = lunes de la semana actual → domingo (inclusive, hora Colombia); comp fijo = 25% (mensual ÷ 4).
- Período editable en el modal de auditoría: inputs Desde/Hasta con default = período calculado; al cambiarlos, se re-filtran los registros del detalle.
- Confirmar liquidación usa el período EDITADO (backend ya acepta períodos arbitrarios — confirmado en `LiquidarEmpleadaUseCase`).

### Out of Scope
- Nada se remueve (MENSUAL/QUINCENAL intactos; filtro de registros por período NO cambia para ellos).
- Sin migración (columna `varchar(20)` ya existe); sin cambios de endpoints, DTOs ni `CuentasPagarUseCase`; sin consumidores n8n/móvil.
- Sin cambio al guard anti-doble-pago (sigue por período; ver Riesgos).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `finanzas-liquidacion`: frecuencia `SEMANAL` (período semanal + factor 25%) y período editable al liquidar (pago fuera de ciclo).

## Approach

Backend: ensanchar `FrecuenciaPago` (types + z.enum + rebuild); `calcularPeriodo` agrega rama SEMANAL (lunes→domingo con `colombia-date.ts`); factor 25% en `NominaPendienteUseCase` y `LiquidarEmpleadaUseCase`; filtro de registros por período incluye SEMANAL. Frontend: en el modal de auditoría, estado `periodoDesde/periodoHasta` inicializado del row, inputs de fecha, re-filtrado local (el fetch es por `usuarioId`; el filtro es client-side), confirmación con el período editado; aviso si el rango solapa el historial. `EmpleadasPage`: opción "Semanal".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/types/src/user.ts` | Modified | `FrecuenciaPago = 'MENSUAL' \| 'QUINCENAL' \| 'SEMANAL'` |
| `packages/validation/src/personas.schema.ts` | Modified | `z.enum` +`'SEMANAL'` (create/update) + rebuild dist |
| `.../liquidacion/NominaPendienteUseCase.ts` | Modified | rama SEMANAL en `calcularPeriodo`; factor 0.25; filtro por semana |
| `.../liquidacion/LiquidarEmpleadaUseCase.ts` | Modified | factor 0.25 en comp fijo registrado |
| `apps/pos-dashboard/src/pages/EmpleadasPage.tsx` | Modified | opción "Semanal" (L928-929); openEdit L239 passthrough SEMANAL |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modified | modal auditoría: inputs Desde/Hasta (default período row), re-filtro (reemplaza `getCurrentPeriod` L2566), confirm con período editado (L2595-2600), header L3128-3132, aviso solapamiento |
| Tests (api + dashboard) | Modified | SEMANAL en NominaPendiente/Liquidar/schema; modal período editable |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Overlap guard: rango fuera de ciclo que solapa una liquidación previa + registros nuevos → paga comp fijo de nuevo (el guard solo chequea registros, no fijo) | Med | Aviso client-side si el rango solapa el historial (estado `historial` ya cargado); backend sin cambios — el override es decisión del owner |
| Rebuild `packages/validation` olvidado | Med | Task explícito `cd packages/validation && npx tsc` + test schema |
| Límites de fecha al editar: `new Date('YYYY-MM-DD')` ≠ borde Colombia | Med | Enviar bordes en ISO `T05:00:00.000Z` (igual que el backend: `colombiaDayStartUTC/EndUTC`), no fechas peladas |
| `openEdit` mapea no-QUINCENAL → MENSUAL (rompería SEMANAL) | Med | Passthrough de los 3 valores en EmpleadasPage L239 + test |

## Rollback Plan

Revert de código (sin migración). MENSUAL/QUINCENAL quedan byte-idénticos: SEMANAL es opt-in por empleada; el período editable solo afecta el modal (el default sigue siendo el calculado).

## Dependencies

- `colombia-date.ts` (existente). Rebuild `packages/validation` previo al restart del API.

## Success Criteria

- [ ] Empleada SEMANAL muestra período lunes→domingo y 25% de comp fijo (Nomina + liquidación registrada).
- [ ] Modal de auditoría precarga Desde/Hasta con el período del row; al editarlos re-filtra registros; confirmar envía el período editado.
- [ ] Suites API + dashboard verdes; MENSUAL/QUINCENAL sin cambios de comportamiento.

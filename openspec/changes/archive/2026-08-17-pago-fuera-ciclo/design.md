# Design: Pago Fuera de Ciclo (SEMANAL + período editable)

## Technical Approach

Dos frentes: (1) backend ensancha `FrecuenciaPago` con `SEMANAL` (período lunes→domingo y factor 0.25) en el único lugar donde se calcula el período (`calcularPeriodo`) y en los dos use cases que aplican el factor; (2) frontend hace OPCIONAL el período en el modal de auditoría: inputs Desde/Hasta con default = período de la fila pendiente, re-filtrado local de registros y confirmación con el período editado. El endpoint `POST /finanzas/nomina/liquidar` ya acepta períodos arbitrarios (confirmado en `LiquidarEmpleadaUseCase.execute` + controller `periodoInicio/periodoFin`) — cero cambios de contrato. Sin migración: la columna ya es `varchar(20)`.

## Architecture Decisions

| # | Decisión | Opciones | Decisión | Rationale |
|---|----------|----------|----------|-----------|
| D1 | Cálculo semana | `getDay()` local vs UTC vs string | Lunes calculado desde el string COT `hoy` con ancla `T12:00:00Z` y `getUTCDay()` | Colombia sin DST; la fecha COT ya es `YYYY-MM-DD`; el ancla de mediodía evita bordes de día |
| D2 | Factor 25% | Solo NominaPendiente vs ambos | Constantes `FACTOR_FIJO_QUINCENAL=0.5` y `FACTOR_FIJO_SEMANAL=0.25` en ambos use cases | Precedente D4 de frecuencia-pago: el historial registra lo realmente pagado; UI y liquidación no drift |
| D3 | Filtro de registros | SEMANAL filtra por semana vs no filtra | SEMANAL filtra por período (igual que QUINCENAL) | Coherente: el pendiente semanal no debe arrastrar registros de semanas previas; MENSUAL intacto |
| D4 | Período editable | Inputs libres vs presets | Inputs `type="date"` Desde/Hasta, default del row; envío en ISO `T05:00:00.000Z` | Preserva bordes Colombia; `new Date('YYYY-MM-DD')` (00:00Z) rompería el filtro `desde` (19:00 COT del día anterior) |
| D5 | Totales del modal | Estáticos del row vs recalculados | Comisiones/propinas recalculadas del detalle filtrado (`useMemo`); bono+sueldo del row (factor ya aplicado) | Si el período cambia, los totales deben reflejar lo que se va a pagar |
| D6 | Guard overlap + comp fijo | Cambiar backend vs aviso | Aviso client-side si el rango editado solapa el historial (estado `historial` ya cargado en la página) | El guard solo bloquea sin registros nuevos; con registros nuevos pagaría comp fijo de nuevo. El override es decisión del owner — sin cambio de semántica |
| D7 | Validación | Solo create vs create+update | `z.enum` +`'SEMANAL'` en ambos + **rebuild `packages/validation`** | `dist/` es la fuente que importa el API |

## Período SEMANAL — Algoritmo (`calcularPeriodo`)

```
hoy = 'YYYY-MM-DD' (COT)
d = new Date(`${hoy}T12:00:00Z`); lunes = (d.getUTCDay() + 6) % 7  # días desde lunes
inicio = addDays(hoy, -lunes); fin = addDays(hoy, 6 - lunes)
periodoInicio = colombiaDayStartUTC(inicio); periodoFin = colombiaDayEndUTC(fin)
factor = SEMANAL ? 0.25 : QUINCENAL ? 0.5 : 1
filtroRegistrosPorPeriodo = (frecuenciaPago === 'QUINCENAL' || frecuenciaPago === 'SEMANAL')
```

## Data Flow

```
Modal auditoría (FinanzasPage)
  handleAuditar: setPeriodoDesde/Hasta ← emp.periodoInicio/periodoFin (default)
  fetch /registros?usuarioId=  ──►  filtro CLIENT-side con (desde, hasta) editados  ──► detalle + totales recalculados
  handleConfirmLiquidar: POST /liquidar { usuarioId, periodoInicio: desdeT05Z, periodoFin: hasta+1dT05Z, ... }
        │
        ▼  (sin cambios)
  LiquidarEmpleadaUseCase (período arbitrario) → LiquidacionEntity [fechaDesde, fechaHasta]
```

Nota: el header del modal (L3128-3132) muestra el mes actual en hora local — se reemplaza por los inputs Desde/Hasta (default = período del row).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/types/src/user.ts` | Modify | `FrecuenciaPago = 'MENSUAL' \| 'QUINCENAL' \| 'SEMANAL'` (L12) |
| `packages/validation/src/personas.schema.ts` | Modify | `z.enum(['MENSUAL','QUINCENAL','SEMANAL'])` en create (L23) y update (L43); **`cd packages/validation && npx tsc`** |
| `.../liquidacion/NominaPendienteUseCase.ts` | Modify | `calcularPeriodo`: rama SEMANAL (lunes→domingo); `FACTOR_FIJO_SEMANAL=0.25` (L32); filtro L110 incluye SEMANAL; factor L155 |
| `.../liquidacion/LiquidarEmpleadaUseCase.ts` | Modify | `factorFijo` L114: SEMANAL → 0.25 (mantener 1/0.5) |
| `apps/pos-dashboard/src/pages/EmpleadasPage.tsx` | Modify | L41 tipo +`'SEMANAL'`; L239 passthrough 3 valores (hoy mapea no-QUINCENAL → MENSUAL, bug para SEMANAL); L928 `<option value="SEMANAL">Semanal</option>` |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modify | estado `periodoAuditarDesde/Hasta` (L2350s); `handleAuditar` init + filtro con período editado (reemplaza `getCurrentPeriod` L2566); inputs en header modal (L3128); confirm L2595-2600 usa período editado; totales `useMemo` del detalle; aviso solapamiento vs `historial` |

## Interfaces / Contracts

```ts
// @pos-final/types (L12)
export type FrecuenciaPago = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL';

// Frontend — bordes enviados al liquidar (formato idéntico al que produce el backend):
const body = {
  usuarioId, 
  periodoInicio: `${desde}T05:00:00.000Z`,      // colombiaDayStartUTC
  periodoFin:   `${hasta}T05:00:00.000Z`,       // colombiaDayEndUTC (hasta = día inclusive)
};
// NominaPendienteEmpleada: sin cambios (ya expone periodoInicio/periodoFin/frecuenciaPago).
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (api) | Período SEMANAL | `NominaPendienteUseCase.test.ts`: `vi.setSystemTime('2026-08-13T12:00:00Z')` (jueves) → [10,16]; lunes 17/08 → [17,23]; assert guard con semana |
| Unit (api) | Factor 25% | NominaPendiente: 200000+50000 → 62500; `LiquidarEmpleadaUseCase.test.ts`: registra 50000/12500 |
| Unit (api) | Schema | `personas.schema.test.ts`: `'SEMANAL'` aceptado en create/update |
| Unit (dashboard) | Select | `EmpleadasPage.test.tsx`: opción Semanal; payload SEMANAL; openEdit precarga SEMANAL |
| Unit (dashboard) | Modal editable | `FinanzasPage.test.tsx`: abre auditoría → inputs precargados con período; cambia Hasta → re-filtra (fetch/render); confirmar → POST con período editado; aviso solapamiento |
| Regression | MENSUAL/QUINCENAL | Suites existentes pasan sin edición |

## Migration / Rollout

No migration. Deploy: rebuild `packages/validation` antes del restart. Sin feature flag: SEMANAL es opt-in por empleada; MENSUAL/QUINCENAL byte-idénticos.

## Open Questions

- [ ] Ninguna bloqueante. Nota: `limit: 50` en el fetch de registros del modal puede dejar fuera registros en rangos largos fuera de ciclo — se conserva (comportamiento existente).

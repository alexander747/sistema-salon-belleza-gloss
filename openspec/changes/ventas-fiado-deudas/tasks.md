# Tasks: Ventas fiado y deudas por cobrar

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1.550-1.950 (4 PRs) |
| 400-line budget risk | High (global) / Medium por PR |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 (stacked-to-main) |
| Delivery strategy | auto-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Base |
|---|---|---|---|
| 1 | Backend abonos + migración + arqueo | PR1 | main (raíz; PR2/PR4 dependen) |
| 2 | Backend reportes cash-basis | PR2 | PR1 |
| 3 | Frontend venta fiado/parcial | PR3 | PR2 (independiente de PR1) |
| 4 | Frontend deudas (abonar) | PR4 | PR3 |

## PR1 — Backend: abonos, migración y arqueo

- [x] 1.1 RED: `AbonarDeudaUseCase` (éxito parcial, salda, 409 excede, 404, 422 anulado/caja, 400)
- [x] 1.2 `PagoTransaccionEntity` +`cajaId`; `TypeORMPagoTransaccionRepository.findByCajaConFallback`
- [x] 1.3 GREEN: `AbonarDeudaUseCase` (verificarCajaAbierta + tx: pago con cajaId hoy, decrementos no negativos)
- [x] 1.4 `abonarDeudaSchema` + **rebuild tsc**; ruta `POST /registros/:id/pagos` + `RegistroController.abonar` + roles
- [x] 1.5 `CreateRegistroUseCase`: `pagosData` +`cajaId`; `calcularReporteCierre` +`pagosExtra`; wiring `CerrarCaja`/`ObtenerEsperado`
- [x] 1.6 `CuentasCobrarUseCase` +`registros[]` (DTO + agrupación); comentario de consistencia actualizado
- [x] 1.7 Script `scripts/backfill-pago-caja.ts`; tests: arqueo abono cross-caja, ruta, DTO, schema
- [x] 1.8 Vitest api verde + `tsc --noEmit`

## PR2 — Backend: reportes cash-basis

- [x] 2.1 RED: PyL/Resumen/ROI con cobrado/fiado; CierreTurno cobrado
- [x] 2.2 Repo `sumPagosPorPeriodo` + `sumMontoPendientePorPeriodo` (join pagos→cajas, COALESCE, excluye ANULADO)
- [x] 2.3 GREEN: `PyLMensualUseCase` +`cobrado`/`fiadoPeriodo`/`deudasPorCobrar`; `utilidadNeta` cash
- [x] 2.4 `ResumenDiaUseCase` +`totalCobrado`/`totalFiadoDia`
- [x] 2.5 `ROIMensualUseCase`: `ingresos` = cobrado; `CierreTurnoUseCase`: `totalAEntregar = Σ pagos − comisión − propina`
- [x] 2.6 `ExcelExportService`: +columna Pendiente +filas Cobrado/Fiado/Deudas
- [x] 2.7 Actualizar fixtures PyL/Resumen/ROI/ReporteController/ExcelExport; vitest api + tsc

## PR3 — Frontend: venta fiado/parcial

- [x] 3.1 RED: WalkInModal/VentasPage/AgendaPage (fiado, parcial, "queda $X pend.")
- [x] 3.2 `WalkInModal`: toggle Fiado + `montoCobrar` editable (todos los métodos) + pendiente + payload `pagos: fiado ? [] : [{monto: montoCobrar}]`
- [x] 3.3 `VentasPage`: mismo patrón (relajar guarda `canSubmit` línea 216)
- [x] 3.4 `AgendaPage` completar cita: `esFiado` + `montoCobrar` en `completarForm` + payload línea 630
- [x] 3.5 Actualizar tests de payload; vitest dashboard + tsc

## PR4 — Frontend: deudas (abonar)

- [x] 4.1 RED: "abonar reduce deuda y refresca"; **reescribir `FinanzasPage.test.tsx:631-637`** (read-only → acciones)
- [x] 4.2 `FinanzasPage`: columna acción en filas CLIENTE + modal (select registro + monto + método) + refresh; PRESTAMO sin botón; errores 409/422 en el modal
- [x] 4.3 RegistrosTab: cards "Cobrado" y "Fiado del período" junto a TOTAL INGRESOS
- [x] 4.4 Vitest dashboard + tsc; build

## Test Break Inventory

| Test | PR | Impacto |
|---|---|---|
| `CreateRegistroUseCase.test.ts` | PR1 | pagos con `cajaId` (asserts compatibles) |
| `calcularReporteCierre.test.ts` | PR1 | +casos `pagosExtra` |
| `CuentasCobrarUseCase.test.ts`, `CuentasController.test.ts` | PR1 | DTO +`registros[]` |
| `finanzas.schema.test.ts` | PR1 | +`abonarDeudaSchema` |
| `PyLMensualUseCase.test.ts`, `ResumenDiaUseCase.test.ts` | PR2 | nuevos campos; fixtures |
| `ReporteController.test.ts` (pyl/roi/cierreTurno/exportar) | PR2 | ingresos → cobrado; totalAEntregar |
| `ExcelExportService.test.ts` | PR2 | +columna/filas |
| `WalkInModal.test.tsx`, `VentasPage.test.tsx`, `AgendaPage.test.tsx` | PR3 | payload parcial/fiado |
| `FinanzasPage.test.tsx:631-637` | PR4 | read-only → acciones (reescribir) |

**Nota**: no hay tests dedicados de `ROIMensualUseCase`/`CierreTurnoUseCase` — su cobertura vive en `ReporteController.test.ts`.

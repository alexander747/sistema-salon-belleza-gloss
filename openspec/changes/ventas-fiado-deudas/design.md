# Design: Ventas fiado y deudas por cobrar

## Technical Approach

Backend-first, 4 PRs stacked-to-main (el plan de 3 PRs aprobado se desdobla en 4 para respetar el budget de revisión). Contabilidad de caja con doble línea: se conservan las líneas devengadas como informativas y se agregan las de caja. La clave es `pagos_transaccion.cajaId` — fecha de recepción del dinero — que habilita arqueo y reportes cash-basis sin tocar la semántica de venta. TDD estricto + rebuild de `packages/validation` en PRs que toquen schemas.

## Architecture Decisions

| # | Decisión | Opciones | Tradeoff | Decisión |
|---|---|---|---|---|
| D1 | Fecha de ingreso (cash) | (a) `pago.cajaId → caja.fechaCaja`, fallback fecha de negocio del registro; (b) columna `fecha` en pago | (b) redundante con la caja | **(a)** `COALESCE(DATE(c.fechaCaja), DATE(COALESCE(r.fechaHora, r.creadoEn)))` |
| D2 | Arqueo con abonos | (a) `pagosExtra[]` en `calcularReporteCierre`; (b) registro sintético | (b) contamina el reporte | **(a)** — suma a `porMetodoPago` y al arqueo EFECTIVO |
| D3 | P&L utilidadNeta | cash vs devengado | dueño: ingreso = cuando se cobra | **cash** (`cobrado − insumos − comisiones − gastos − devoluciones`); devengado informativo |
| D4 | `cliente.deudaTotal` | mantener desnormalizada vs recomputar | drift conocido; recomputar = re-arquitectura | **mantener** — crear/abonar/devolver/anular la actualizan (#8) |
| D5 | `CierreTurno.totalAEntregar` | montoTotal vs cobrado | montoTotal pide entregar lo no cobrado | **cobrado** (`Σ pagos − comisión − propina`) — alinea la spec que ya decía `totalCobrado` |
| D6 | Anulación con pago parcial | corregir vs documentar | edge preexistente | **documentar** como limitación (#9) |
| D7 | Modal de abono | elegir registro vs abono global | endpoint es por registro | **desglose `registros[]` en DTO**; modal con select (default: más antiguo) |
| D8 | Propina en fiado total | dejar vs fiarla | la propina se asume pagada al momento | **dejar** (semántica existente); open question |

## Data Flow

```
Venta fiada:  POST /registros {pagos: []} → montoPendiente = max(0, valorFinal − propina)
              comisión sobre valor completo; pago.cajaId = caja del registro
Abono:        POST /registros/:id/pagos {monto} → verificarCajaAbierta(hoy) → tx:
                PagoTransaccion{cajaId: hoy} + montoPendiente −= monto + deudaTotal −= monto
Arqueo:       pagosCaja = {p.cajaId = C} ∪ {p.cajaId NULL ∧ r.cajaId = C} → porMetodoPago
P&L cash:     cobrado = Σ pagos por fecha recepción en [desde,hasta] (no ANULADO)
              fiadoPeriodo = Σ montoPendiente de registros del período
              deudasPorCobrar = Σ montoPendiente de registros no ANULADO con fecha ≤ hasta
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `PagoTransaccionEntity.ts` | Modify | +`cajaId` (FK nullable, SET NULL) + ManyToOne Caja |
| `TypeORMPagoTransaccionRepository` + port | Modify | +`findByCajaConFallback(cajaId)` |
| `CreateRegistroUseCase.ts` | Modify | `pagosData` +`cajaId: caja.id` |
| `AbonarDeudaUseCase.ts` | Create | validación + tx (pago, decrementos, caja de hoy) |
| `finanzas.schema.ts` (validation) | Modify | +`abonarDeudaSchema`; **rebuild tsc** |
| `RegistroController.ts` + `finanzas.routes.ts` | Modify | +`abonar` + ruta `POST /registros/:id/pagos` (roles S/D/A/R) |
| `calcularReporteCierre.ts` | Modify | +`pagosExtra?: Array<{monto, metodoPago}>` |
| `CerrarCajaUseCase.ts` / `ObtenerEsperadoCajaUseCase.ts` | Modify | arqueo con `pagosCaja` |
| `IRegistroServicioRepository` + TypeORM impl | Modify | +`sumPagosPorPeriodo`, +`sumMontoPendientePorPeriodo` |
| `CuentasCobrarUseCase.ts` + `CuentasDTO.ts` | Modify | +`registros[]`; comentario obsoleto actualizado |
| `PyLMensualUseCase.ts` | Modify | +`cobrado`/`fiadoPeriodo`/`deudasPorCobrar`; `utilidadNeta` cash |
| `ResumenDiaUseCase.ts` | Modify | +`totalCobrado`/`totalFiadoDia` |
| `ROIMensualUseCase.ts` | Modify | `ingresos` = cobrado del mes |
| `CierreTurnoUseCase.ts` | Modify | `totalAEntregar = Σ pagos − comisión − propina` |
| `ExcelExportService.ts` | Modify | +columna Pendiente; +filas Cobrado/Fiado/Deudas |
| `WalkInModal.tsx`, `VentasPage.tsx`, `AgendaPage.tsx` | Modify | toggle Fiado + `montoCobrar` + "Queda $X pend." |
| `FinanzasPage.tsx` | Modify | modal Cobrar/Abonar + refresh; cards Cobrado/Fiado |
| `scripts/backfill-pago-caja.ts` | Create | `UPDATE pagos SET cajaId = registro.cajaId WHERE cajaId IS NULL` (una vez, opcional) |

## Interfaces / Contracts

```ts
// packages/validation
abonarDeudaSchema = { monto: z.number().positive(), metodoPago: enum, referencia?: string }
// IRegistroServicioRepository (nuevos)
sumPagosPorPeriodo(salonId, desde, hasta, usuarioId?): Promise<number>;   // cobrado cash
sumMontoPendientePorPeriodo(salonId, desde?, hasta?): Promise<number>;    // fiado / deudas
// CuentaCobrarDTO +=
registros: Array<{ registroId; fechaHora; montoPendiente }> | null
// PyLMensualOutput +=
cobrado: number; fiadoPeriodo: number; deudasPorCobrar: number;
```

## Testing Strategy

| Capa | Qué | Cómo |
|---|---|---|
| Unit (api) | AbonarDeuda (éxito/salda/409/404/422/400), `calcularReporteCierre` +pagosExtra, repo sums | vitest api |
| Unit (api) | PyL/Resumen/ROI cash; CierreTurno cobrado | fixtures actualizados |
| Integración | ruta POST /registros/:id/pagos; arqueo con abono cross-caja | controller tests |
| Frontend | WalkInModal/VentasPage/AgendaPage fiado+parcial; FinanzasPage modal abono | vitest dashboard |

## Migration / Rollout

1. Entidad + DB_SYNCHRONIZE → `cajaId` nullable (sin downtime; pagos legacy válidos).
2. Script opcional `backfill-pago-caja.ts` (tsx, una vez).
3. En adelante `CreateRegistro` y `AbonarDeuda` siempre setean `pago.cajaId`.
4. Rebuild `packages/validation` + restart API por PR.

## Open Questions

- [ ] D8: ¿la propina en venta fiada total debe fiarse también? (hoy queda excluida de la deuda; sin cambio de backend)
- [ ] `deudasPorCobrar`: snapshot a `hasta` (propuesto) vs todos los saldos sin filtro

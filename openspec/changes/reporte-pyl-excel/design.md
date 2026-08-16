# Design: Monthly P&L Report + Excel Export

## Technical Approach

Add a period P&L query (`GET /finanzas/pyl`) via a new `PyLMensualUseCase` that reuses the discount-proportion math from `ResumenDiaUseCase` (extracted to a shared pure helper), sums gastos via existing `IGastoRepository` methods, and sums devoluciones via a new `IDevolucionRepository.sumBySalonAndDateRange`. Excel export (`GET /finanzas/exportar`) is a second handler that reuses the same P&L data path plus period registros through an `ExcelExportService` (exceljs). Frontend ReportesTab is rewritten to drive both. Two stacked PRs (PR1 P&L, PR2 Excel).

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| D1 | New `PyLMensualUseCase`; don't modify ResumenDia/ROI | Extend ROI, modify ResumenDia | Owner decision: devoluciones only in new use case; avoids regressions in legacy endpoints; ROI stays for compat |
| D2 | Extract discount math into `reporte/calculo-registro.ts` (pure fn) | Duplicate in PyLMensual | Single source of truth for descuento-proporción; ResumenDia refactor is a small, test-covered loop swap |
| D3 | Colombia dates via `colombiaDayStartUTC/EndUTC` (05:00 UTC) | ROI local-time `new Date(y,m,1,0,0,0)` | ROI pattern uses server-local time → wrong day boundaries; helper is the established correct pattern |
| D4 | New `sumBySalonAndDateRange` on IDevolucionRepository (SQL SUM `montoDevolucion` on `creadoEn`) | `findBySalon` + in-memory filter | DevolucionEntity has no fecha column; SQL sum matches `GastoRepository.sumBySalonAndDateRange`; avoids loading all rows |
| D5 | `ExcelExportService` orchestrates (injects `PyLMensualUseCase` + `IRegistroServicioRepository`); pure `buildPyLWorkbook` → Buffer | Controller fetches data; xlsx/csv lib; client-side generation | Keeps controller thin; pure builder is unit-testable; exceljs supports styling; API-first (no client-side data path) |
| D6 | Inline zod `safeParse` in controller for query params | Add schemas to `@pos-final/validation` | Avoids validation-package rebuild + dist sync (AGENTS.md gotcha); only 3 optional params; matches existing controller `safeParse` pattern |
| D7 | Blob download: `api.get(url, { params, responseType: 'blob' })` → `createObjectURL` → `a.click()` | Server base64 JSON; window.open | Reuses axios JWT interceptors; native binary download; error branch reads blob text and surfaces message |

## Data Flow

```
ReportesTab ──GET /salones/:id/finanzas/pyl?desde&hasta&usuarioId──▶ ReporteController.pyl
  (role rule: privileged | forced usuarioId)                          │
                                                              PyLMensualUseCase
      registroRepo.search(desde, hasta [05:00 UTC], usuarioId) ◀─────┤
      gastoRepo.sumBySalonAndDateRange + search(categoria split) ─────┤
      devolucionRepo.sumBySalonAndDateRange (NEW) ────────────────────┤
                                                              JSON P&L ──▶ cards
ReportesTab ──GET /finanzas/exportar (mismos params)──▶ ExcelExportService
      PyLMensualUseCase + registroRepo.search ──▶ buildPyLWorkbook ──▶ Buffer ──▶ .xlsx
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/finanzas/application/use-cases/reporte/calculo-registro.ts` | Create | Pure discount helper (proporción, contribuciones servicios/productos) |
| `apps/api/src/modules/finanzas/application/use-cases/reporte/PyLMensualUseCase.ts` | Create | P&L computation + output shape |
| `apps/api/src/modules/finanzas/application/use-cases/reporte/ResumenDiaUseCase.ts` | Modify | Use shared helper (behavior identical) |
| `apps/api/src/modules/finanzas/domain/ports/IDevolucionRepository.ts` | Modify | + `sumBySalonAndDateRange` |
| `apps/api/src/modules/finanzas/infrastructure/persistence/TypeORMDevolucionRepository.ts` | Modify | SQL SUM impl |
| `apps/api/src/modules/finanzas/application/services/ExcelExportService.ts` | Create | Build workbook + orchestrate export |
| `apps/api/src/modules/finanzas/presentation/controllers/ReporteController.ts` | Modify | + `pyl`, `exportar` handlers (safeParse, role rule) |
| `apps/api/src/modules/finanzas/presentation/routes/finanzas.routes.ts` | Modify | + GET `/finanzas/pyl`, `/finanzas/exportar` |
| `apps/api/src/shared/container.ts` | Modify | Register `PyLMensualUseCase`, `ExcelExportService` |
| `apps/api/package.json` | Modify | + `exceljs` |
| `apps/pos-dashboard/src/pages/FinanzasPage.tsx` | Modify | ReportesTab rewrite (P&L fetch/render, usuarioId filter, export blob) |

## Interfaces / Contracts

```ts
interface PyLMensualInput { salonId: number; desde?: string; hasta?: string; usuarioId?: number; }
interface PyLMensualOutput {
  desde: string; hasta: string; cantidadAtenciones: number;
  ingresosBrutos: number; descuentos: number; ingresosNetos: number;
  totalServicios: number; totalProductos: number; propinas: number;
  costoBaseInsumos: number; margenBruto: number; comisiones: number;
  gastosFijos: number; gastosOperativos: number; gastosPorCategoria: Record<string, number>;
  totalGastos: number; devoluciones: number; utilidadNeta: number;
}
// IDevolucionRepository +
sumBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<number>;
// ExcelExportService
class ExcelExportService {
  async exportar(input: PyLMensualInput & { salonId: number }): Promise<{ buffer: Buffer; filename: string }>;
  buildPyLWorkbook(pyl: PyLMensualOutput, movimientos: RegistroMovimiento[]): ExcelJS.Workbook; // pure, exported for tests
}
```

Number rounding: `Math.round` per registro contribution (same as ResumenDia); output values rounded to 2 decimals. `gastosPorCategoria` grouped from `gastoRepo.search({ salonId, desde, hasta })` by `GastoEntity.categoria`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `calculo-registro` helper | Pure fn cases incl. 0-descuento, 100% descuento, propina-only |
| Unit | `PyLMensualUseCase` | Mocked repos; spec scenarios (all factors, empty, devolución, usuarioId filter, ANULADO excluded) |
| Unit | `ExcelExportService.buildPyLWorkbook` | Sheets exist, header row, COP format string, totals row |
| Controller | `ReporteController` (pyl/exportar) | Mock use cases; role forcing, safeParse 400, res.send(buffer) + headers |
| Frontend | `FinanzasPage.test.tsx` | desde+hasta in request, P&L cards rendered, export triggers blob download (mock `createObjectURL`) |

## Migration / Rollout

No migration — no schema change. Rollout: PR1 (P&L endpoint + tab fix) → PR2 (Excel). Both additive; revert per proposal.

## Open Questions

- None blocking. Minor: keep the ROI card in ReportesTab alongside P&L, or replace? (Default: replace — ROI endpoint stays available.)

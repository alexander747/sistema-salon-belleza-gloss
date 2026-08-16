# Proposal: Monthly P&L Report + Excel Export

## Intent

The salon owner needs real per-period profitability (revenue, discounts, costs, commissions, expenses, refunds, net profit) plus Excel export. Current reports fall short: `resumen-dia` is single-day only; `ROI mensual` ignores discounts and refunds and double-counts labor (nómina + comisiones). ReportesTab also has two bugs: `reporteHasta` is never sent, and the client-side "ganancia neta" ignores comisiones and insumos.

## Scope

### In Scope
- `GET /finanzas/pyl`: period P&L — ingresos brutos/netos, descuentos, servicios/productos, propinas, costo base insumos, margen bruto, comisiones, gastos (fijos/operativos/por categoría), devoluciones, utilidad neta
- `utilidadNeta = ingresosNetos − costoBaseInsumos − comisiones − gastos − devoluciones` (no nómina line — comisiones cover labor, avoids double-count)
- Devoluciones as explicit deduction, in the new P&L use case only
- Role rule: privileged see all; restricted forced to own `usuarioId` (same as resumenDia)
- `GET /finanzas/exportar`: `.xlsx` with P&L + Movimientos sheets (exceljs)
- ReportesTab rewrite: sends `desde`+`hasta`+`usuarioId`, P&L cards, Export blob download
- Colombia dates via `colombia-date.ts` (05:00 UTC), not ROI local-time pattern

### Out of Scope
- Changing `ResumenDiaUseCase` / `ROIMensualUseCase` behavior; n8n mirror (JWT-only v1 — follow-up); nómina line in formula

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `finanzas-reportes`: ADDED P&L + export requirements; legacy "devoluciones MUST reduce" clause corrected (spec never matched code).

## Approach

New `PyLMensualUseCase` reusing ResumenDia's discount logic (extracted to a shared helper). Devoluciones summed via new `IDevolucionRepository.sumBySalonAndDateRange`. `ExcelExportService` (exceljs) builds the workbook from P&L data + period registros. Controllers use inline zod `safeParse` (no validation-package rebuild). Delivered as 2 stacked PRs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `use-cases/reporte/` — `PyLMensualUseCase.ts`, `calculo-registro.ts` | New | P&L computation + shared discount helper |
| `IDevolucionRepository.ts` + `TypeORMDevolucionRepository.ts` | Modified | + `sumBySalonAndDateRange` (SQL SUM) |
| `ReporteController.ts`, `finanzas.routes.ts` | Modified | + `pyl`, `exportar` handlers/routes |
| `ExcelExportService.ts` | New | Workbook → Buffer |
| `shared/container.ts` | Modified | Register new deps |
| `FinanzasPage.tsx` (ReportesTab) | Modified | P&L fetch/render + export |
| `apps/api/package.json` | Modified | + `exceljs` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Devoluciones spec gap (legacy req never coded) | High | Explicit P&L line + spec delta fixes clause |
| Nómina double-count | Med | Formula excludes nómina; comisiones only |
| Validation-package rebuild | Med | Inline zod safeParse — no package change |
| Colombia dates wrong (ROI pattern) | Med | `colombiaDayStartUTC/EndUTC` + boundary tests |
| First blob-download pattern | Med | `responseType: 'blob'`, error reads blob text |

## Rollback Plan

- **PR1**: git revert (additive endpoint, no schema change); tab falls back.
- **PR2**: revert export route, drop `exceljs`, remove button; P&L cards unaffected.
- No data migration — pure revert.

## Dependencies

- `exceljs` added to `apps/api` (new dep, isolated to service layer); `zod` already present

## Success Criteria

- [ ] `GET /finanzas/pyl` math matches spec scenarios against seeded data
- [ ] ReportesTab sends `desde`+`hasta`; cards match API values
- [ ] Export downloads valid `.xlsx` (2 sheets), opens in Excel/LibreOffice
- [ ] Restricted role sees only own records in `pyl` and `exportar`
- [ ] All api + dashboard vitest suites pass

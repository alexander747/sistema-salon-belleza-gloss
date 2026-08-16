# Tasks: Monthly P&L Report + Excel Export

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1000 total (PR1 ~600–650, PR2 ~300–350) |
| 400-line budget risk | Medium (PR1 exceeds 400; within project 800-line budget) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (P&L endpoint + ReportesTab) → PR 2 (Excel export) |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | P&L endpoint + ReportesTab fix | PR 1 | Backend + frontend; tests with code; base = main |
| 2 | Excel export + blob download | PR 2 | Reuses `PyLMensualUseCase`; base = main |

## PR 1 — P&L endpoint + ReportesTab fix

- [x] 1.1 Add `sumBySalonAndDateRange` to `IDevolucionRepository` + `TypeORMDevolucionRepository` (SQL SUM `montoDevolucion`, `creadoEn` in `[desde, hasta)`)
- [x] 1.2 Create `reporte/calculo-registro.ts` pure discount helper (proporción + contribuciones servicios/productos)
- [x] 1.3 Refactor `ResumenDiaUseCase` loop to use the helper (behavior identical — existing tests must pass)
- [x] 1.4 Create `PyLMensualUseCase` (`PyLMensualInput`/`Output`; Colombia dates; gastos split via `search` + `sumBySalonAndDateRange`; devoluciones sum; `utilidadNeta = ingresosNetos − insumos − comisiones − gastos − devoluciones`)
- [x] 1.5 Register `PyLMensualUseCase` in `shared/container.ts`
- [x] 1.6 Add `pyl` handler to `ReporteController`: inline zod `safeParse`, `REGISTROS_PRIVILEGED_ROLES` rule (restricted forced own `usuarioId`)
- [x] 1.7 Add `GET /finanzas/pyl` to `finanzas.routes.ts`
- [x] 1.8 Tests: `PyLMensualUseCase.test.ts` (all factors, empty, devolución, ANULADO excluded, usuarioId filter) + `ReporteController.test.ts` (role forcing, safeParse 400)
- [x] 1.9 Rewrite ReportesTab in `FinanzasPage.tsx`: fetch P&L with `desde`+`hasta`+`usuarioId`, render P&L cards, drop client-computed "ganancia neta" (~line 3935) and `totalComisiones`-as-Nómina card (~line 3921)
- [x] 1.10 Update `FinanzasPage.test.tsx`: mock `/finanzas/pyl`, assert both dates sent and cards render

## PR 2 — Excel export

- [ ] 2.1 Add `exceljs` to `apps/api/package.json` (`npm install exceljs`)
- [ ] 2.2 Create `ExcelExportService`: pure `buildPyLWorkbook(pyl, movimientos)` (P&L + Movimientos sheets; header fill `#4f46e5`, COP `'$#,##0'`, column widths) + `exportar()` orchestrating `PyLMensualUseCase` + `registroRepo.search`
- [ ] 2.3 Register `ExcelExportService` in `shared/container.ts`
- [ ] 2.4 Add `exportar` handler to `ReporteController`: same role rule + safeParse; Content-Type/Content-Disposition; `res.send(buffer)`
- [ ] 2.5 Add `GET /finanzas/exportar` to `finanzas.routes.ts`
- [ ] 2.6 Frontend: Export button + `downloadExcel` helper (`responseType: 'blob'`, error branch reads blob text)
- [ ] 2.7 Tests: `ExcelExportService.test.ts` (sheets, headers, formats) + `ReporteController.test.ts` exportar cases + `FinanzasPage.test.tsx` blob case (mock `createObjectURL`)

## Verification (both PRs)

- [ ] 3.1 `cd apps/api && npx vitest run --reporter=verbose` green
- [ ] 3.2 `cd apps/pos-dashboard && npx vitest run` green
- [ ] 3.3 `cd apps/api && npx tsc --noEmit` green (inline schemas — no validation rebuild)
- [ ] 3.4 Manual: seeded range → P&L cards match API; export opens in Excel/LibreOffice

## Dependency Notes

- No DB migration. No `@pos-final/validation` change (inline zod — avoids dist rebuild gotcha).
- n8n mirror deferred (reports JWT-only v1) — document in PR description, not code.

# Verify Report — reporte-pyl-excel (PR1 P&L + PR2 Excel)

- **Branch:** `feat/pyl-excel` (PR1 `feat/pyl-mensual` stacked + PR2 Excel on top)
- **Base:** `main` (e92a26c)
- **Mode:** standard verify (no strict TDD config); static + test-based. E2E/server verification NOT yet performed (pending orchestrator).
- **Date:** 2026-08-16
- **Verdict:** ✅ **PASS WITH ISSUES**

---

## 1. Task Completeness

| Task | Status |
|------|--------|
| 1.1 `sumBySalonAndDateRange` port + repo impl | ✅ |
| 1.2 `calculo-registro.ts` pure helper | ✅ |
| 1.3 ResumenDia refactor to helper | ✅ (tests pass; see W-1) |
| 1.4 `PyLMensualUseCase` | ✅ |
| 1.5 Container registration | ✅ |
| 1.6 `pyl` handler (safeParse + role rule) | ✅ |
| 1.7 Route GET /finanzas/pyl | ✅ |
| 1.8 Unit tests use case + controller | ✅ |
| 1.9 ReportesTab rewrite | ✅ (client-computed ganancia neta & comisiones-as-nómina cards removed) |
| 1.10 FinanzasPage tests | ✅ |
| 2.1 `exceljs` dep | ✅ (^4.4.0, lockfile) |
| 2.2 `ExcelExportService` | ✅ |
| 2.3 Container registration | ✅ |
| 2.4 `exportar` handler (role rule + headers + send) | ✅ |
| 2.5 Route GET /finanzas/exportar | ✅ |
| 2.6 Frontend Export button + blob download | ✅ |
| 2.7 Excel/controller/tab tests | ✅ |
| 3.1–3.4 Verification tasks | 🔲 (this report; 3.4 manual/E2E pending) |

10/10 apply tasks complete (both PRs). 0 incomplete implementation tasks.

## 2. Build / Type Check

| Command | Result | New errors |
|---------|--------|-----------|
| `apps/api` `npx tsc --noEmit` | exit 2 — **only pre-existing** | **0** |
| `apps/pos-dashboard` `npx tsc --noEmit` | exit 2 — **only pre-existing** | **0** |

Pre-existing errors confirmed byte-identical to `main` via git worktree (same 3 API + 5 dashboard errors in untouched files):
- `seed.ts(238)` — ServicioEntity save overload
- `CreateRegistroUseCase.test.ts(86)` — missing `serviciosItems`
- `RegistroServicioItemDTO.test.ts(3)` — module not found
- `AgendaPage.tsx(195,1405,1423)`, `DashboardPage.tsx(335)`, `ServiciosPage.tsx(372)` — TS6133/TS2304

## 3. Test Suites

| Suite | Result |
|-------|--------|
| `apps/api` `npx vitest run` | 312 passed / 2 failed (52 files passed, 1 failed) |
| `apps/pos-dashboard` `npx vitest run` | 50 / 50 passed (8 files) |

API failures — **both pre-existing** (`RegistroController.test.ts` `list` ×2; file untouched by branch):
- `should return 200 with registros`
- `should pass filter params when provided`

`CajaCerradaFlows` (dashboard, 2 tests) passed this run — flakiness not reproduced.

## 4. Coverage (api, v8 via lcov.info)

| File | % Lines | Threshold | Status |
|------|---------|-----------|--------|
| `PyLMensualUseCase.ts` | 100.0 | ≥80% | ✅ |
| `calculo-registro.ts` | 100.0 | ≥80% | ✅ |
| `ExcelExportService.ts` | 100.0 | ≥80% | ✅ |
| `ReporteController.ts` | 96.3 (incl. pyl/exportar fully covered) | ≥80% | ✅ |

New test files (all green): `PyLMensualUseCase.test.ts` (7), `calculo-registro.test.ts` (5), `ExcelExportService.test.ts` (13), `ReporteController.test.ts` (17), `ResumenDiaUseCase.test.ts` (4), `TypeORMDevolucionRepository.test.ts` (2), `colombia-date.test.ts` (4), `FinanzasPage.test.tsx` (13).

## 5. Spec Compliance Matrix

| # | Scenario | Result | Covering test (passed) |
|---|----------|--------|------------------------|
| 1 | P&L with all factors (350000/315000/35000/20000/−93000) | ✅ PASS | PyLMensualUseCase "calcula el P&L completo…" |
| 2 | P&L empty period (all zeros + 0 atenciones) | ✅ PASS | PyLMensualUseCase "período vacío…" |
| 3 | Math check `utilidadNeta = ingresosNetos − insumos − comisiones − gastos − devoluciones` (no nómina, propina pass-through) | ✅ PASS | PyLMensualUseCase #1 asserts −93000 with exact composition |
| 4 | Devoluciones deducted as explicit line | ✅ PASS | PyLMensualUseCase "deduce las devoluciones…" (20000 → 80000) |
| 5 | ANULADO excluded | ✅ PASS | PyLMensualUseCase "excluye registros ANULADO…"; ExcelExportService "excluye registros ANULADO de los movimientos" |
| 6 | Privileged filters by empleada (`usuarioId=5`) | ✅ PASS | ReporteController pyl "honra el filtro por usuario para roles privilegiados" |
| 7 | Restricted forced to self (`MANICURISTA` id=4, `usuarioId=99` ignored) | ✅ PASS | ReporteController pyl + exportar; FinanzasPage "rol restringido…" |
| 8 | Download headers (xlsx content-type + attachment filename `pyl_<desde>_<hasta>.xlsx`) | ✅ PASS | ReporteController exportar "devuelve el xlsx con headers…" |
| 9 | Empty period export (both sheets, zeros) | ✅ PASS | ExcelExportService "período vacío…" |
| 10 | Both dates sent (desde+hasta, no dead reporteHasta) | ✅ PASS | FinanzasPage "envía desde y hasta…" + "el resumen del período envía desde y hasta…" |
| 11 | P&L cards from API values (no client recomputation) | ✅ PASS | FinanzasPage "renderiza las tarjetas del P&L…" |
| 12 | Export click → blob download (responseType blob, createObjectURL, a.click, revoke; error branch reads blob text) | ✅ PASS | FinanzasPage Exportar describe (3 tests) |
| M1 | Resumen con datos (MODIFIED req) | ⚠️ PARTIAL | ResumenDiaUseCase approval test covers discount/propinas/comisiones math; not verbatim 3-registro+gasto scenario (see S-1) |
| M2 | Resumen día vacío (MODIFIED req) | ⚠️ UNTESTED | No covering test (see W-2) |

## 6. Design Coherence

| Decision | Compliance |
|----------|-----------|
| D1 New `PyLMensualUseCase`, don't extend ROI; devoluciones only in new use case | ✅ |
| D2 Shared `calculo-registro.ts`; ResumenDia "behavior identical" | ⚠️ W-1 (rounding nuance) |
| D3 Colombia dates via `colombiaDayStartUTC/EndUTC` (05:00 UTC) | ✅ (registros + devoluciones; gastos use midnight-UTC bounds against `date` column with closed `>= / <=` — correct for the DATE column) |
| D4 `sumBySalonAndDateRange` SQL SUM on `creadoEn` half-open `[desde, hasta)` | ✅ |
| D5 `ExcelExportService` orchestrates; pure `buildPyLWorkbook`; exceljs | ✅ |
| D6 Inline zod safeParse (no validation-package rebuild) | ✅ |
| D7 Blob download with error branch reading blob text | ✅ |

## 7. API Surface Regression Check

`resumenDia`, `roiMensual`, `cierreTurno` handlers byte-identical to main (diff adds only `pyl`/`exportar` + zod import + `ValidationError`). Routes `/finanzas/resumen`, `/finanzas/roi`, `/finanzas/turno/:id` unchanged. `colombia-date.getColombiaDateString` now accepts optional date param (backwards compatible) and the machine-timezone-dependent formula was replaced by pure UTC-shift — new formula verified correct at the 05:00 UTC boundary by `colombia-date.test.ts`. ResumenDia (4), CajaController (13), CajaTab (15), CajaBannerPages (2), CajaCerradaFlows (2) suites all green.

## 8. Findings

### CRITICAL
None.

### WARNING
- **W-1 — ResumenDia refactor rounding nuance (design deviation, low impact).** Old code: `totalIngresos += Math.round((servBruto+prodBruto)*proporcion)`; new: `totalIngresos += servContrib + prodContrib` (sum of individually-rounded parts). Can differ by ±1 per registro at fraction boundaries (e.g. 50% discount on odd amounts). Design D2 claimed "behavior identical"; approval tests pass because their data avoids the boundary. New behavior is arguably more consistent (`totalServicios + totalProductos === totalIngresos`). No spec broken; flagging for awareness.
- **W-2 — MODIFIED requirement "Resumen día vacío" has no covering test.** Behavior is pre-existing and unchanged, but the refactor touched `ResumenDiaUseCase` and no test pins the empty-period path. Suggest adding one (approval) test in a follow-up.

### SUGGESTION
- **S-1 — Spec scenario "Resumen con datos" references `gastosOperativos=10000`, but `ResumenDiaOutput` exposes `totalGastos` (no `gastosOperativos` field).** Doc-only mismatch in the delta spec wording (pre-existing API shape).
- **S-2 — E2E pending.** Tasks 3.4 (seeded range → cards match API; export opens in Excel/LibreOffice) and success-criteria item 3 not yet executed against a running server. Orchestrator should run server verification (HTTP-level checks for `/finanzas/pyl` and `/finanzas/exportar` incl. role forcing and real xlsx bytes) before archive.

## 9. Artifact Confirmation

- proposal.md, spec.md, design.md, tasks.md present ✅
- This verify report persisted ✅
- Verification tasks 3.1–3.3 evidenced above; 3.4 pending orchestrator E2E.

**Next:** `ready-for-archive` (after orchestrator E2E confirmation) — or `fixes-required` only if W-1/W-2 must block.

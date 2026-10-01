# Verification Report: insumos-en-resumen-reportes-nomina — PR6 revisión

**Change**: `insumos-en-resumen-reportes-nomina` (PR6 revisión: backend `cobrosDeudaAnterior` + frontend renombres + tira de reconciliación)
**Mode**: Strict TDD (`strict_tdd: true`, vitest runner present)
**Repo / Branch**: `/home/hellhammer/Escritorio/proyectos/pos-final` @ `feat/insumos-reportes-pr6-aclaracion`
**Commits under verification**: `81a499d` (backend `cobrosDeudaAnterior`) → `893dc5f` (frontend renombres + tira). Base PR5 `6c2106e`.
**Superseded**: `b4967a9` (old tooltip/conditional-line PR6) — no longer present in behavior.
**Verified by**: sdd-verify executor (fresh context, independent of the author)
**Date**: 2026-09-30

---

## Commits under verification

| Commit | Subject |
|---|---|
| `81a499d` | feat(finanzas): agregar cobrosDeudaAnterior al resumen y eliminar DTO muerto |
| `893dc5f` | feat(finanzas): renombrar cards y agregar tira de reconciliacion en Registros |

`git diff --stat 6c2106e 893dc5f` → 16 files, +1061 / −26. No PR1–PR5 core file touched (verified separately).

---

## 1. Build & Tests Execution (actual output)

### API — `cd apps/api && npx vitest run`
```
 Test Files  1 failed | 86 passed (87)
      Tests  2 failed | 632 passed (634)
   Duration  17.68s
```
Failures (both in `NominaPendienteUseCase.test.ts`, a file **NOT touched** by PR6):

```
 FAIL  .../NominaPendienteUseCase.test.ts > excluye empleada ya liquidada en el período sin registros nuevos
 AssertionError: expected [ { empleadaId: 8, …(13) } ] to have a length of +0 but got 1

 FAIL  .../NominaPendienteUseCase.test.ts > incluye empleada con registros NUEVOS posteriores a la última liquidación
 AssertionError: expected [ { empleadaId: 9, …(13) }, …(1) ] to have a length of 1 but got 2
```
**No NEW failures.** Prompt baseline was 623 passed / 5 known date-dependent failures; today the same date-dependent family yields only 2 failures (today = 2026-09-30). Total grew 628 → 634 = **+6 new tests** (3 repo + 3 use case), all passing.

### API — `npx tsc --noEmit`
```
src/infrastructure/persistence/seed.ts(238,23): error TS2769: No overload matches this call.
TSC_EXIT=2
```
Exactly the 1 baseline `seed.ts` error. ✅

### Dashboard — `cd apps/pos-dashboard && npx vitest run`
```
 Test Files  2 failed | 32 passed (34)
      Tests  2 failed | 410 passed (412)
   Duration  40.74s
```
Failures (both pre-existing, independently proven below):

1. `src/__tests__/mobileBottomSheet.test.ts` → asserts `globals.css` contains `align-items: flex-end`. `globals.css` is untouched by PR6 (byte-identical `git diff` name list). Pre-existing.
2. `FinanzasPage.test.tsx > tab Reportes (P&L mensual) > cambiar las fechas refetchea el P&L automáticamente`. **Byte-identical on base `6c2106e`** (verified with `git show 6c2106e:... | sed -n '300,335p'`); PR6 hunks start at line 346, so this test is untouched. Fails because today is 2026-09-30 → `findAllByDisplayValue(firstOfMonthStr='2026-09-01')` returns only the "desde" input, so `dateInputs[1]` is undefined. Date-dependent, pre-existing. Both fail identically in isolation (`-t` single-test run).

Baseline (391/≤2) → 410 passed / 2 failed. **No NEW failures.**

### Dashboard — `npx tsc --noEmit`
```
(no output)
```
0 errors. ✅

### Targeted new-test runs (all GREEN)
```
API:  TypeORMRegistroServicioRepository(19) + ResumenDiaUseCase(14) + ReporteController(23)
      Test Files 3 passed | Tests 56 passed
Web:  tiraReconciliacion.test.ts → 7 passed
Web:  FinanzasPage.test.tsx -t "PR6 revisión" → 12 passed | 62 skipped
```

---

## 2. Spec Compliance Matrix

### `specs/finanzas-reportes/spec.md` — Cobros de deuda anterior en el resumen

| Scenario | Test | Result |
|---|---|---|
| Definición exacta (no derivada en el frontend) | `ResumenDiaUseCase.test.ts > PR6a — expone cobrosDeudaAnterior…` (asserts 20000 + identity) | ✅ COMPLIANT |
| Un pago sobre un registro del período no cuenta | `TypeORMRegistroServicioRepository.test.ts > sumCobrosDeudaAnterior` pins `FECHA_NEGOCIO_REGISTRO_SQL < :fechaRegistroAnteriorStr` | ✅ COMPLIANT |
| Mismos filtros y exclusión de ANULADO | same describe asserts `r.estado != ANULADO`, `usuarioId=4`, `clienteId=7` | ✅ COMPLIANT |
| Visible para todos los roles | `ReporteController.test.ts > no privilegiado (MANICURISTA/RECEPCIONISTA) … SÍ cobrosDeudaAnterior` | ✅ COMPLIANT |
| Sin deuda anterior cobrada | `ResumenDiaUseCase.test.ts > PR6a — sin cobros de deuda anterior → 0` | ✅ COMPLIANT |

### `specs/finanzas-registros/spec.md` — Nombres y aclaración accesible

| Scenario | Test | Result |
|---|---|---|
| Tarjetas renombradas (old labels gone) | `FinanzasPage.test.tsx > renombra las tarjetas a "Ventas del día"…` | ✅ COMPLIANT |
| Afijo ⓘ accesible y re-formulado | `…expone un ⓘ enfocable…` + two tooltip-content tests | ✅ COMPLIANT |
| Sin tarjetas nuevas | `…NO agrega tarjetas…` asserts 7 `summaryCard` | ✅ COMPLIANT |

### `specs/finanzas-registros/spec.md` — Tira de reconciliación

| Scenario | Test | Result |
|---|---|---|
| La tira siempre se renderiza (Cobrado===Ingresos) | `…la tira SIEMPRE se renderiza (aunque Cobrado === Ingresos)` | ✅ COMPLIANT |
| Filas de componente en 0 se ocultan | builder `…oculta las filas de componente…` + component `…oculta las filas…` | ✅ COMPLIANT |
| TU CAJA REAL = Entró a caja − Propinas | builder `TU CAJA REAL = Cobrado − Propinas` (940000−5000=935000) + component test | ✅ COMPLIANT |
| Reconciliación del día (identidad del owner) | builder + component `reconcilia el día completo en orden` | ✅ COMPLIANT |
| Período histórico con venta cobrada después | builder prints API values as-is (no derived rows except `caja-real`); asserted in rounding/pass-through test | ✅ COMPLIANT |
| Sin scroll horizontal en mobile | structural test + CSS `@media (max-width:480px)` | ⚠️ PARTIAL — jsdom has no layout engine; scroll claim is CSS-level/manual |

**Compliance summary**: 14/14 scenarios covered; 13 COMPLIANT, 1 PARTIAL (mobile scroll — not runtime-assertable).

---

## 3. Required trap checks — evidence

| Trap | Result | Evidence |
|---|---|---|
| Registros labels EXACTLY "Ventas del día" / "Entró a caja"; old gone | ✅ | `FinanzasPage.tsx:897,916`; test `queryByText(/TOTAL INGRESOS/)` + `queryByText('💰 Cobrado')` absent |
| Strip ALWAYS renders; 0-components hidden; closings always | ✅ | `FinanzasPage.tsx:1017` unconditional; `tiraReconciliacion.ts:50-72`; builder 7/7 tests |
| `TU CAJA REAL = totalCobrado − totalPropinas` exactly | ✅ | `tiraReconciliacion.ts:70`; unit test asserts 935000 and −4000 |
| No new card/metric/row | ✅ | test asserts 7 `summaryCard`; no `🎁 Propinas` |
| `cobrosDeudaAnterior` in `ResumenDiaOutput` + returned for ALL roles | ✅ | `ResumenDiaUseCase.ts:31,76,169`; `ReporteController.ts:77` destructures only `totalCostoBaseInsumos`/`balanceNeto`; controller test asserts field for MANICURISTA/RECEPCIONISTA |
| "anterior" predicate = REGISTRO business date; payment window = PAYMENT business date (caja-first), not conflated | ✅ | `FECHA_NEGOCIO_PAGO_SQL` (caja-first) for window; `FECHA_NEGOCIO_REGISTRO_SQL = DATE_FORMAT(COALESCE(r.fechaHora,r.creadoEn),'%Y-%m-%d')` for `< inicio`; **both pinned** in repo test |
| `aclaracionCobrado.ts` + its test DELETED | ✅ | `find` returns none under `src`; grep 0 refs; `ls utils/` no such file |
| Dead `ResumenDiaDTO.ts` deleted (truly unreferenced) | ✅ | source deleted; `grep -rn ResumenDiaDTO apps --include=*.ts` → 0; only stale `apps/api/dist/**` (gitignored build output) remains |
| Responsive mobile rule | ✅ CSS / ⚠️ runtime | `.tiraRow` flex-wrap + min-width:0 + overflow-wrap:anywhere; `@media (max-width:480px){ flex-direction:column }` at `FinanzasPage.module.css:179-187`; structural test documents jsdom limitation |
| Regression PR1–PR5 (role gating, nómina insumo, pagination) | ✅ | `git diff --name-only 6c2106e 893dc5f` touches **no** `privilegedRoles`/`aplicarFiltros`/`NominaPendiente`/routes/`ListRegistros` file; `isPrivileged` gating intact at `FinanzasPage.tsx:964` |

### Live API / DB (read-only, no writes)
- `GET /api/salones/1/finanzas/resumen` with no auth → `HTTP 401` (route exists). A live HTTP field check was **not** performed because login writes `usuario.refreshToken` (`JwtTokenService.ts:53`), violating the read-only constraint.
- Read-only MySQL query (container `posfinal-mysql`) executing the exact repository SQL:
```
cobrosDeudaAnterior(2026-09-04..09-29)   0.00
pagos_total_salon1                        119
pagos_con_fecha_pago>fecha_registro         0
```
Query executes correctly; dataset has no qualifying payment → expected `0` ("Sin deuda anterior cobrada"). Field presence over HTTP is proven by the controller/use-case unit tests.

---

## 4. TDD Compliance (Strict TDD)

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | apply-progress Engram #511 has "TDD Cycle Evidence (PR6 revisión)" table |
| All tasks have tests | ✅ | 18/18 Phase 8 tasks; test files exist for every task |
| RED confirmed (tests exist) | ✅ | `TypeORMRegistroServicioRepository.test.ts`, `ResumenDiaUseCase.test.ts`, `ReporteController.test.ts`, `tiraReconciliacion.test.ts`, `FinanzasPage.test.tsx` |
| GREEN confirmed (tests pass on execution) | ✅ | 56 (api targeted) + 7 (builder) + 12 (PR6 describe) all pass |
| Triangulation adequate | ✅ | builder 7 cases (order, zero-hide, caja-real, empty, rounding, negative); repo 3 (predicate/filters/NULL); use case 3; page 12 |
| Safety Net for modified files | ✅ | FinanzasPage.test.tsx had existing suite (72 tests pre-change); repo/use-case tests extended in place |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (pure/repo/use-case/controller) | 7 + 3 + 3 + 2 = 15 | 4 | vitest |
| Integration / Component | 12 (PR6 describe) | 1 | @testing-library/react + jsdom |
| E2E | 0 | 0 | not installed |
| **Total** | **27** | **5** | |

### Changed File Coverage
Coverage analysis skipped — no coverage run in verify (informational only; not a failure).

### Assertion Quality
```
2 CSS-class structural assertions:
  FinanzasPage.test.tsx:2276  container.querySelectorAll('[class*="summaryCard"]')  toHaveLength(7)
  FinanzasPage.test.tsx:2310  container.querySelector('[class*="tiraReconciliacion"]') not.toBeNull()
```
Both are intentional "no new cards" / mobile-structure checks, paired with behavioral assertions (labels, values). No tautologies, no ghost loops, no type-only-only assertions, no mock-heavy tests.

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `FinanzasPage.test.tsx` | 2276 / 2310 | CSS-class selectors | Implementation-detail coupling | WARNING (acknowledged deviation) |

### Quality Metrics
**Linter**: ➖ Not run
**Type Checker**: ✅ API 1 baseline error (`seed.ts`) / ✅ Dashboard 0 errors

---

## 5. Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D7 renames (`Ventas del día` / `Entró a caja`), `Total insumos` untouched | ✅ | `FinanzasPage.tsx:897,916,966` |
| D7 strip: pure builder, always rendered, outside `summaryGrid`, 0-components hidden, closings always | ✅ | `tiraReconciliacion.ts` + `:1017` |
| D7 only client computation `caja-real = cobrado − propinas` | ✅ | `tiraReconciliacion.ts:70` |
| D7 `cobrosDeudaAnterior` non-sensitive → all roles | ✅ | controller destructuring omits only the 2 sensitive keys |
| D7 responsive flex + `≤480px` stack | ✅ | `FinanzasPage.module.css:129-187` |
| D7 delete old helper + test; delete dead DTO | ✅ | both done |
| D5 use-case output stays required internal; HTTP frontend type optional | ✅ | `ResumenDiaOutput.cobrosDeudaAnterior: number`; `FinanzasResumen.cobrosDeudaAnterior?: number` |

No design deviation that breaks a spec.

---

## 6. Issues Found

### CRITICAL
None.

### WARNING
1. **Mobile "no horizontal scroll" is not runtime-verifiable.** The component test is structural only; jsdom has no layout engine, so the spec scenario "Sin scroll horizontal en mobile" is proven at CSS level (`flex-wrap`, `min-width:0`, `overflow-wrap:anywhere`, `@media (max-width:480px)` stacking) and must rely on the documented manual check. Evidence: `FinanzasPage.module.css:179-187`; test comment at `FinanzasPage.test.tsx:2303-2307`.
2. **Two CSS-class structural assertions** (`FinanzasPage.test.tsx:2276,2310`) — acknowledged intentional deviation from the strict-TDD "no CSS-class assertions" rule; paired with behavioral assertions.

### SUGGESTION
1. **Old owner labels still exist on other surfaces** (outside PR6's declared scope of "resumen de Registros"):
   - `FinanzasPage.tsx:4506` — Reportes P&L "Dinero de caja" card `💰 Cobrado`
   - `FinanzasPage.tsx:4604` — ROI Mensual card `💰 TOTAL INGRESOS`
   The PR6 spec requirement is explicitly scoped to the Registros summary, so this is **not a violation**, but the owner may want terminology consistency across tabs. No code change in PR6 is required for spec compliance.
2. Stale compiled build artifacts `apps/api/dist/**/ResumenDiaDTO.{js,d.ts,...}` remain from the deleted source DTO. `apps/api/dist` is gitignored; harmless, cleaned on next build.

---

## Verdict

**PASS WITH WARNINGS**

Revised PR6 satisfies every in-scope spec scenario with passing covering tests (13 COMPLIANT, 1 PARTIAL mobile-scroll which is CSS-level by nature). Backend `cobrosDeudaAnterior` is correctly wired, exposed to all roles, and pins the two distinct business-date notions without conflating them. No PR1–PR5 regressions; all new tests GREEN; type-checks at baseline; no CRITICAL issues. The two dashboard failures and two API failures are pre-existing/date-dependent and untouched by this change.

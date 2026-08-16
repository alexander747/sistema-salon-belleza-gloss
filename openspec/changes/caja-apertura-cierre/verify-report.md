# Verification Report — caja-apertura-cierre

**Change**: caja-apertura-cierre (PR1–PR5)
**Mode**: Strict TDD (vitest, jsdom)
**Verifier**: sdd-verify sub-agent
**Date**: 2026-08-16

## Verdict

**PASS WITH WARNINGS** — implementation matches specs/design/tasks. All caja requirements implemented and covered by passing tests; the only failing tests are pre-existing (RegistroController). Owner decision (cash-only arqueo) is correctly implemented and the spec scenario needs the documented adjustment.

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 35 (1.1–1.35, 2.1–2.9, 3.1–3.6, 4.1–4.5) |
| Tasks complete ([x]) | 34 |
| Tasks incomplete | 1 — Task 4.5 (E2E manual) — requires server/DB, documented as pending in apply-progress |

---

## Build & Tests Execution

**API suite** — `cd apps/api && npx vitest run`
```text
✓ 233 passed | ✗ 2 failed (both RegistroController.test.ts — PRE-EXISTING, zero diff from main)
Test Files  1 failed | 42 passed (43)
```
The 2 failures (`list` should return 200 with registros; `should pass filter params`) exist identically on `main` (git diff main...HEAD shows zero changes to `RegistroController.ts` and `RegistroController.test.ts`).

**Dashboard suite** — `cd apps/pos-dashboard && npx vitest run`
```text
✓ 28 passed (7 files) — confirmed on 2 full runs
```
Note: 1 intermittent failure in `CajaCerradaFlows.test.tsx` (findByText timeout under full-suite parallel load) on the first run; passes in isolation and on 2 subsequent full runs → load flake, not a regression.

**API typecheck** — `cd apps/api && npx tsc --noEmit`
```text
3 errors, ALL pre-existing (identical on main):
- seed.ts(238,23) — seed.ts unchanged from main
- CreateRegistroUseCase.test.ts(86,9) — validInput missing serviciosItems; main has same shape at line 83
- RegistroServicioItemDTO.test.ts(3,44) — file unchanged, pre-existing bad import path
```

**Dashboard typecheck** — `cd apps/pos-dashboard && npx tsc --noEmit`
```text
5 errors, ALL pre-existing baseline (documented in apply-progress):
AgendaPage.tsx istart/setClientes/status, DashboardPage.tsx todayStr, ServiciosPage.tsx handleToggleActive
```

**Coverage** (changed caja module files, `vitest --coverage`):

| File | % Stmts | % Branch | Rating |
|------|---------|----------|--------|
| `use-cases/caja/*` (5 UCs + calcularReporteCierre) | 99.41 | 88.46 | ✅ Excellent |
| `services/verificarCajaAbierta.ts` | 100 | 100 | ✅ Excellent |
| `infrastructure/persistence/TypeORMCajaRepository.ts` | 0 | 0 | ⚠️ Low — no repo unit tests exist anywhere in codebase (consistent pattern) |

Aggregate of covered caja files: 82.83% (aggregate pulled down by untested repository; use-case layer alone is 99.41%).

---

## Spec Compliance Matrix — finanzas-caja (8 reqs / 19 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-01 POST Abrir Caja | Apertura exitosa | `AbrirCajaUseCase.test.ts > should create caja ABIERTA with fechaCaja de hoy y aperturaPorId` | ✅ COMPLIANT |
| REQ-01 | Caja ya abierta | `AbrirCajaUseCase.test.ts > should throw CajaYaAbiertaError...` | ✅ COMPLIANT |
| REQ-01 | Día ya cerrado | `AbrirCajaUseCase.test.ts > should throw CajaYaCerradaError cuando ya existe CERRADA (no reapertura)` | ✅ COMPLIANT |
| REQ-02 Regla de Oro Ventas | Registro sin caja abierta | `CreateRegistroUseCase.test.ts > should throw CajaCerradaError when no caja ABIERTA exists and not persist` | ✅ COMPLIANT |
| REQ-02 | Registro con caja abierta | `CreateRegistroUseCase.test.ts > should persist cajaId from the open caja on the registro` (cajaId=5) | ✅ COMPLIANT |
| REQ-03 Completar Cita | Completar sin caja abierta | `CompletarCitaUseCase.test.ts > should throw CajaCerradaError and leave the cita CONFIRMADA` | ✅ COMPLIANT |
| REQ-03 | Estado COMPLETADA sin caja | `CambiarEstadoCitaUseCase.test.ts > should throw CajaCerradaError when transitioning to COMPLETADA` | ✅ COMPLIANT |
| REQ-03 | Otros estados no bloqueados | `CambiarEstadoCitaUseCase.test.ts > should NOT block CANCELADA when no caja is open` | ✅ COMPLIANT |
| REQ-04 POST Cerrar Caja | Cierre exitoso | `CerrarCajaUseCase.test.ts > ...pagos EFECTIVO 180000 − gastos EFECTIVO 20000 = 160000` | ✅ COMPLIANT |
| REQ-04 | Cierre con diferencia | `CerrarCajaUseCase.test.ts > ...diferencia -5000` | ✅ COMPLIANT |
| REQ-04 | Caja ya cerrada | `CerrarCajaUseCase.test.ts > should throw CajaYaCerradaError cuando la caja ya está CERRADA` | ✅ COMPLIANT |
| REQ-04 | Cierre concurrente | `CerrarCajaUseCase.test.ts > should throw CajaYaCerradaError cuando el update condicional no gana (race)` | ✅ COMPLIANT |
| REQ-05 Reporte de Cierre | Reporte completo | `calcularReporteCierre.test.ts > should build the complete report with breakdown (owner decision: arqueo cash-only)` | ⚠️ COMPLIANT* — cash-only math implemented and asserted (montoEsperado=180000 for its gastos mix); spec scenario total (260000) must be adjusted (see Spec Adjustment) |
| REQ-06 GET Caja Actual | Caja abierta | `ObtenerCajaActualUseCase.test.ts > should devolver la caja ABIERTA actual` + CajaController | ✅ COMPLIANT |
| REQ-06 | Sin caja abierta | `ObtenerCajaActualUseCase.test.ts > should lanzar CajaNoAbiertaError` | ✅ COMPLIANT |
| REQ-07 Historial | Historial paginado | `ListarCierresCajaUseCase.test.ts > should devolver {data, meta} paginado ... fechaCaja DESC` | ✅ COMPLIANT |
| REQ-08 API-First | Formato de error | `errorHandler.test.ts` (envelope `{ok:false,data:null,error:{code,message,details}}`) | ✅ COMPLIANT |
| REQ-08 | Consumo desde n8n | `CajaController.test.ts > should pasar aperturaPorId null cuando no hay req.user (n8n)` + static: n8n.routes mirrors apiKeyGuard+tenantGuard | ✅ COMPLIANT (controller-level) |

**finanzas-registros delta** (3 scenarios): Registro sin caja ✅ / Registro con caja ✅ / Registro legado sin caja ✅ (cajaId nullable, search/count filter optional; `CreateRegistroUseCase.test.ts` + static repository inspection).

**finanzas-gastos delta** (3 scenarios): Gasto con caja ✅ (cajaId=5) / Gasto sin caja ✅ (cajaId NULL, NOT gated) / Gastos en reporte ✅ (`calcularReporteCierre` totalGastos=30000).

**Compliance summary**: 19/19 finanzas-caja scenarios covered (18 fully compliant, 1 flagged spec adjustment with passing cash-only test) + 6/6 delta scenarios. 0 UNTESTED, 0 FAILING (excluding pre-existing).

---

## Golden Rule — chokepoint verification (static + tests)

| Chokepoint | Verified | Evidence |
|------------|----------|----------|
| CreateRegistroUseCase — paso 0 antes de validar cliente, 422 CAJA_CERRADA, cajaId en create() | ✅ | `CreateRegistroUseCase.ts:36` `verificarCajaAbierta(...)` before cliente validation; `:109` `cajaId: caja.id`; tests 422-no-persist + cajaId=5 |
| CompletarCitaUseCase — tras findById antes de cambiarEstado | ✅ | `CompletarCitaUseCase.ts:30` verifies before `cambiarEstado`; test: cita queda CONFIRMADA |
| CambiarEstadoCitaUseCase — solo estado COMPLETADA (tras validarTransicion) | ✅ | `CambiarEstadoCitaUseCase.ts:37` `if (input.estado === EstadoCita.COMPLETADA)`; test CANCELADA no bloqueado |
| CreateGastoUseCase — cajaId asociado, NO gated | ✅ | `CreateGastoUseCase.ts:30-43` `caja?.id ?? null`; tests: cajaId=5 / NULL |

---

## Cash-Only Arqueo (owner decision)

`calcularReporteCierre.ts:92` — `montoEsperado = round2(porMetodoPago.EFECTIVO - gastosEfectivo)` where `gastosEfectivo` filters `metodoPago ?? 'EFECTIVO' === 'EFECTIVO'` (line 89). Excludes ANULADO (`:63`). Verified by 5 passing tests (cash-only math, diferencia ±, ANULADO excluded, porMetodoPago breakdown, null-real preview). ✅ **Implementation matches owner decision exactly.**

---

## n8n Mirrors

`n8n.routes.ts:17-21` — all 5 routes (`actual`, `actual/esperado`, `abrir`, `cerrar`, `cierres`) with `apiKeyGuard + tenantGuard`, reusing `CajaController` handlers → same `{ok,data,error}` shape. `apiKeyGuard` sets `req.salonId` but not `req.user` → auditores null (controller uses `req.user?.id ?? null`). ✅

---

## Frontend

- `CajaBanner.tsx` + `CajaTab.tsx` exist; `FinanzasPage.tsx` TABS includes `{key:'caja', label:'💰 Caja'}`, renders `<CajaTab/>` + `<CajaBanner onNavigateToCaja>`; `?tab=caja` param supported (line 350).
- CajaBanner mounted in `AgendaPage.tsx:740` and `VentasPage.tsx:435`.
- CAJA_CERRADA handling: `cajaError.ts` helper (`isCajaCerradaError`), used in `WalkInModal.tsx:483`, `AgendaPage.tsx:627` (setCompletarError + modal open), `VentasPage.tsx:378`; all dispatch `caja-refresh`. Tests: `CajaCerradaFlows.test.tsx` (2), `WalkInModal.test.tsx` (3), `CajaBannerPages.test.tsx` (2), `cajaError.test.ts` (4). ✅

---

## Migration & Entities

Migrations `1700000000009-CreateCajas.ts`, `1700000000010-AddCajaIdRegistros.ts`, `1700000000011-AddCajaIdGastos.ts` — all with up/down, FK + UNIQUE + indexes per design. `CajaEntity` matches design (nullable auditores, UNIQUE salonId+fechaCaja, idx salonId+estado). `RegistroServicioEntity`/`GastoEntity` have nullable cajaId + ManyToOne. Entity discovery via database.ts glob (`entities/**/*.{ts,js}`) — functionally equivalent to task 1.5's "registrar en lista". ✅

---

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | TDD Cycle Evidence table in apply-progress (PR4) + prior batches |
| All tasks have tests | ✅ | 34/34 completed tasks mapped to test files |
| RED confirmed (tests exist) | ✅ | All test files exist in codebase (verified via glob/read) |
| GREEN confirmed (tests pass) | ✅ | 233/233 caja-related pass; 28/28 dashboard (2 flaky-run recovered) |
| Triangulation adequate | ✅ | 5 tests (Abrir), 5 (Cerrar), 5 (Reporte), 4 (Listar), 2 (Actual), 9 (Controller), 4 (cajaError) |
| Safety Net for modified files | ✅ | Baseline runs documented (19/19 PR3, 233 pass PR2) |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (backend) | 59 (caja-related) | 10 files | vitest |
| Integration (frontend RTL) | 28 | 7 files | vitest + jsdom + RTL |
| E2E | 0 | 0 | not available (task 4.5 pending env) |
| **Total** | **87** | **17** | |

### Assertion Quality

✅ All assertions verify real behavior — no tautologies, no type-only-only assertions, no ghost loops, no empty-array-only checks, no smoke-only renders (banner/tab tests assert text + button behavior + POST calls). Mock:assertion ratio healthy (mocks are repo interfaces, assertions assert values passed).

### Quality Metrics

**Linter**: ➖ Not configured/run
**Type Checker**: ⚠️ 8 pre-existing errors (3 API + 5 dashboard), zero new errors in changed files

---

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **TypeORMCajaRepository.ts 0% coverage** — explicit verify target was ≥80% for new caja module files including the repository. Consistent with the codebase (no TypeORM repo has unit tests anywhere), but the stated coverage target for this file is not met. Use-case layer (99.41%) and guard (100%) exceed target.
2. **Dashboard flake** — `CajaCerradaFlows.test.tsx` failed once under full-suite parallel load (findByText timeout, line 117); passed in isolation and 2 subsequent full runs. Likely load-sensitive timing on the calendar cita render. Not a regression, but could intermittently red the pipeline.
3. **Task 4.5 (E2E manual) incomplete** — documented as pending server/DB environment; only incomplete task in the change.
4. **Spec scenario mismatch (owner override, expected)** — "Reporte completo" scenario total 260000 ≠ cash-only. See Spec Adjustment.

**SUGGESTION**:
1. Add a legacy-registro test: GET `/registros/:id` with `cajaId=NULL` returns 200 intact (spec scenario covered only statically).
2. Add a route-level n8n mirror test (supertest) asserting same shape through apiKeyGuard — currently covered only at controller level.
3. `CajaCerradaFlows.test.tsx` could inject a fixed date to remove calendar timing sensitivity.

---

## Spec Adjustment Needed

**Spec**: `openspec/changes/caja-apertura-cierre/specs/finanzas-caja/spec.md`
**Requirement**: REQ-05 Reporte de Cierre
**Scenario**: "Reporte completo" (GIVEN 3 registros: servicios=240000, productos=60000, descuentos=10000, comisiones=96000, pagos EFECTIVO=200000 + TARJETA=90000; 2 gastos=30000)

| Field | Spec value (WRONG) | Correct (cash-only owner) |
|-------|--------------------|---------------------------|
| montoEsperado | 260000 (Σ todos los pagos − Σ gastos) | **170000** (= EFECTIVO 200000 − gastos EFECTIVO 30000; gastos sin metodoPago asumidos EFECTIVO per design gotcha #3) |

All other scenario totals (ingresosBrutos=300000, descuentos=10000, ingresosNetos=290000, porMetodoPago={EFECTIVO:200000,TARJETA:90000}, comisiones=96000, gastos=30000, cantidadMovimientos=5) remain correct — only `montoEsperado` (and any diferencia derived from it) changes.

*Note: the covering test `calcularReporteCierre.test.ts` (line 102) asserts montoEsperado=180000 using its own gastos mix (20000 EFECTIVO + 10000 TRANSFERENCIA → 200000−20000). Both are cash-only; the spec scenario should be adjusted to 170000 and, optionally, the test extended to mirror the exact spec scenario.*

---

## Verdict

**PASS WITH WARNINGS** — all 8 finanzas-caja requirements (19 scenarios) plus finanzas-registros/gastos deltas are implemented and covered by passing tests; golden rule enforced at all 3 chokepoints with cash-only arqueo per owner decision; zero new test/type errors (only pre-existing failures); the only incomplete item is the manual E2E (task 4.5) requiring environment. Spec scenario "Reporte completo" requires the documented cash-only adjustment (260000 → 170000). Ready for archive after the spec adjustment is applied by the orchestrator.

---

# PR5 — Reapertura de caja (POST /salones/:id/caja/reabrir)

**Verifier**: sdd-verify sub-agent
**Date**: 2026-08-16
**Commits**: `fa6cd4d` (backend) + `8587433` (dashboard), merged into `main` (HEAD)
**Mode**: Standard verify (tests run; pre-existing failures allowed and listed)

## Verdict

**PASS** — PR5 implementation matches spec requirement "POST Reabrir Caja" (3/3 scenarios covered by passing tests) and tasks 5.1–5.6. Race safety and same-caja invariants hold. No new type errors, no new test failures. The only failures in full runs are the documented pre-existing ones (RegistroController ×2 API; CajaCerradaFlows dashboard flake). Real E2E already confirmed by orchestrator: reabrir 200 → ya abierta 409 → vender 201 → esperado 65000 → cerrar diferencia 0.

## Build & Tests Execution (PR5)

**API typecheck** — `cd apps/api && npx tsc --noEmit`
```text
3 errors, ALL pre-existing (identical to PR1-4 baseline, zero in PR5 files):
- seed.ts(238,23); CreateRegistroUseCase.test.ts(86,9); RegistroServicioItemDTO.test.ts(3,44)
```

**Dashboard typecheck** — `cd apps/pos-dashboard && npx tsc --noEmit`
```text
5 errors, ALL pre-existing baseline: AgendaPage.tsx ×3 (istart/setClientes/status),
DashboardPage.tsx (todayStr), ServiciosPage.tsx (handleToggleActive). Zero in CajaTab/CajaBanner.
```

**API suite** — `cd apps/api && npx vitest run`
```text
✓ 240 passed | ✗ 2 failed (both RegistroController.test.ts — PRE-EXISTING, documented in PR1-4 report;
confirmed same 2 fail in isolation). Test Files 1 failed | 43 passed (44).
PR5 added 4 tests → 233 → 240.
```

**Dashboard suite** — `cd apps/pos-dashboard && npx vitest run`
```text
✓ 33 passed | ✗ 1 failed (CajaCerradaFlows.test.tsx:117 — KNOWN LOAD FLAKE documented in PR1-4 report;
passes in isolation 2/2 and on CajaTab run). Test Files 1 failed | 6 passed (7).
```

**PR5-focused runs** (all green):
```text
ReabrirCajaUseCase.test.ts ......... 4 passed (4)    ✓
CajaTab.test.tsx ................... 13 passed (13)  ✓  (6 reabrir-specific)
CajaCerradaFlows.test.tsx (isolado) 2 passed (2)     ✓  (flake confirmed, not regression)
```

## Spec Compliance Matrix — REQ "POST Reabrir Caja" (3 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| POST Reabrir Caja | Reabrir caja cerrada hoy (id 5, close data cleared, no new row) | `ReabrirCajaUseCase.test.ts > should reabrir la MISMA caja de hoy (id 5) limpiando los datos de cierre, sin crear fila nueva` | ✅ COMPLIANT |
| POST Reabrir Caja | Reabrir cuando ya está abierta → 409 CAJA_YA_ABIERTA | `ReabrirCajaUseCase.test.ts > should throw CajaYaAbiertaError cuando la caja de hoy ya está ABIERTA` | ✅ COMPLIANT |
| POST Reabrir Caja | Reabrir sin caja de hoy → 404 CAJA_NO_ABIERTA | `ReabrirCajaUseCase.test.ts > should throw CajaNoAbiertaError cuando no existe caja para hoy` | ✅ COMPLIANT |

**Compliance summary**: 3/3 scenarios compliant (plus 1 extra race test). 0 UNTESTED, 0 FAILING.

## Correctness (Static Evidence)

| Item | Status | Evidence |
|------|--------|----------|
| `ReabrirCajaUseCase` busca caja de hoy por `getColombiaDateString()` | ✅ | `ReabrirCajaUseCase.ts:26-27` `findBySalonYFecha(salonId, fechaCaja)` |
| null → 404 CAJA_NO_ABIERTA | ✅ | `:29-31` `throw new CajaNoAbiertaError()` (errors.ts:106 → 404/CAJA_NO_ABIERTA) |
| ABIERTA → 409 CAJA_YA_ABIERTA | ✅ | `:32-34` `caja.estado !== 'CERRADA'` → `CajaYaAbiertaError()` (errors.ts:88 → 409/CAJA_YA_ABIERTA) |
| CERRADA → estado ABIERTA + limpiar montoEsperado/montoRealEfectivo/diferencia/cierrePorId/cierreEn | ✅ | `:44-52` DTO built with all 5 close fields null; repo UPDATE sets them NULL |
| Misma fila, NO crear nueva | ✅ | `reabrir(id)` es UPDATE por id (nunca insert); test asserts `result.id === 5`; UNIQUE (salonId, fechaCaja) intacto |
| Race safety (UPDATE condicional estado='CERRADA'→ABIERTA, afectados===1) | ✅ | `TypeORMCajaRepository.ts:53-69` `.where('id = :id AND estado = :estado', { estado: 'CERRADA' })`, `affected === 1`; mismo patrón que `cerrar()` (:30-46); race test: `reabrir` false → CajaYaAbiertaError |
| Ruta web `POST /salones/:salonId/caja/reabrir` con `requireRole(S,D,A,R)` | ✅ | `finanzas.routes.ts:92-96` `requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)` |
| Controller `reabrir` 200 `{ok:true,data}` | ✅ | `CajaController.ts:52-59`; `CajaController.test.ts` describe 'reabrir' (200 + error→next) |
| Mirror n8n `POST /api/n8n/:salonId/caja/reabrir` | ✅ | `n8n.routes.ts:21` `apiKeyGuard + tenantGuard + cajaController.reabrir` (auditores null vía `req.user?.id ?? null`) |
| DI registration | ✅ | `container.ts:320` `container.register(ReabrirCajaUseCase, ...)` |
| Frontend: botón "Reabrir caja" solo si caja de hoy CERRADA, confirm(), POST, caja-refresh | ✅ | `CajaTab.tsx:297-322` (handleReabrir), `:353-357` (hoyCerrada), `:422-431` (render); 6 tests en `CajaTab.test.tsx` (visible/no-visible/confirm-POST/cancel/409/404) |

## Issues Found (PR5)

**CRITICAL**: None.

**WARNING**:
1. **Dashboard flake (pre-existing, no nuevo)** — `CajaCerradaFlows.test.tsx:117` falló 1 vez en la corrida completa (timeout findByText); pasa en aislamiento 2/2 y en la corrida de CajaTab. Ya documentado en PR1-4; no es regresión de PR5.

**SUGGESTION**:
1. **Test de ruta n8n reabrir (supertest)** — el mirror `n8n.routes.ts:21` se verifica solo estáticamente + a nivel controller; no hay test de ruta con apiKeyGuard real (misma deuda ya listada en PR1-4, ahora también aplica a reabrir).
2. **`TypeORMCajaRepository.reabrir` sin test directo** — cubierto vía use case (mock devuelve true/false); no hay patrón de repo tests en el codebase (deuda documentada, consistente).
3. Tasks.md `5.8` (verificación) queda como ejecutada por este reporte; E2E manual confirmado por orchestrator fuera de banda.

## PR5 Completeness

| Metric | Value |
|--------|-------|
| Tasks total (PR5) | 8 (5.1–5.8) |
| Tasks complete | 7 (5.1–5.7) + 5.8 ejecutada por esta verificación |
| Tasks incomplete | 0 |

## Verdict

**PASS** — 3/3 escenarios de "POST Reabrir Caja" cumplidos con tests pasando; invariantes de race (UPDATE condicional estado='CERRADA') y de misma-caja (id 5 preservado, sin fila nueva) verificados; ruta web con requireRole S,D,A,R y mirror n8n con apiKeyGuard+tenantGuard presentes; tsc sin errores nuevos (solo baseline pre-existente); 4/4 tests de use case + 13/13 de CajaTab + controller reabrir tests en verde; E2E real confirmado (reabrir 200 → 409 → vender 201 → esperado 65000 → cerrar dif 0). El cambio queda listo para archive.

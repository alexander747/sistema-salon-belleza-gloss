## Verification Report

**Change**: `insumo-por-gramo-y-cantidad-servicios`
**Version**: N/A (openspec delta)
**Mode**: Strict TDD (vitest, `strict_tdd: true`)
**Branch under verification**: `feat/insumo-por-gramo-pr3-citas` (PR1→PR2→PR3 stacked)
**Merge base**: `25635aa`
**Scope**: 56 files changed, +3235 / −136 (PR1+PR2+PR3)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 33 |
| Tasks complete | 32 |
| Tasks incomplete | 1 (`4.1` AGENTS.md docs — cleanup task) |

### Build & Tests Execution

**API tests**: ⚠️ 588 passed / ❌ 5 failed / 0 skipped (84 files)
```text
$ cd apps/api && npx vitest run
 Test Files  1 failed | 83 passed (84)
      Tests  5 failed | 588 passed (593)
All 5 failures in NominaPendienteUseCase.test.ts — pre-existing baseline, unrelated to this change.
```
**Dashboard tests (default parallel)**: ⚠️ 354 passed / ❌ 3 failed (32 files)
```text
$ cd apps/pos-dashboard && npx vitest run
 FAIL src/__tests__/mobileBottomSheet.test.ts                                  (baseline)
 FAIL src/pages/__tests__/FinanzasPage.test.tsx > ...auto-refresh              (baseline)
 FAIL src/pages/__tests__/AgendaPage.test.tsx > C3 quick-add (line 396)        (flake, see W2)
```
**Dashboard tests (single-thread)**: ✅ 355 passed / ❌ 2 failed — exactly the known baseline
```text
$ cd apps/pos-dashboard && npx vitest run --no-file-parallelism
 FAIL mobileBottomSheet.test.ts
 FAIL FinanzasPage.test.tsx > auto-refresh
 Test Files  2 failed | 30 passed (32)   Tests  2 failed | 355 passed (357)
```
**AgendaPage in isolation**: ✅ 30/30 passed.

**API type-check**: ⚠️ 1 error, pre-existing
```text
$ cd apps/api && npx tsc --noEmit
src/infrastructure/persistence/seed.ts(238,23): error TS2769 ... 'nombre' (baseline seed.ts error)
EXIT: 2
```
**validation build**: ✅ exit 0
```text
$ cd packages/validation && npx tsc
EXIT: 0   (dist/ rebuilt, gitignored)
```
**Coverage**: ➖ Not available — no coverage tool configured for these suites.
**Live DB schema (read-only, `posfinal-mysql:3307`, real prod copy)**:
```text
citas_servicios    → citasId int PRI, serviciosId int PRI, cantidad int NOT NULL DEFAULT 1  (2 legacy rows intact)
servicios          → tipoCostoInsumo varchar(20) NOT NULL DEFAULT 'FIJO', precioPorGramo decimal(12,2) NULL
registros_servicio_items → gramosUsados decimal(12,2) NULL, precioPorGramo decimal(12,2) NULL
```
This proves `DB_SYNCHRONIZE=true` applied the new columns additively and did **not** recreate/rename `citas_servicios`.

### Spec Compliance Matrix

Statuses: ✅ COMPLIANT · ⚠️ PARTIAL · ❌ UNTESTED

#### Capability: `costo-insumos-por-gramo`
| # | Scenario | Test | Result |
|---|----------|------|--------|
| 1.1 | Servicio POR_GRAMO válido (201 + fields) | `servicios.schema.test.ts` accept; `CreateServicioUseCase.test.ts` persist/DTO; `ServicioController.test.ts` 201+passthrough | ✅ COMPLIANT |
| 1.2 | POR_GRAMO sin precio rechazado (422) | `servicios.schema.test.ts` rejects; HTTP returns **400** (`ValidationError`), not 422 | ⚠️ PARTIAL |
| 1.3 | Default FIJO retrocompatible | `servicios.schema.test.ts`; `CreateServicioUseCase.test.ts`; `ServicioDTO.test.ts` legacy | ✅ COMPLIANT |
| 2.1 | Costo real derivado en el servidor (cliente `costoBaseInsumos:0` ignorado) | `CreateRegistroUseCase.test.ts` > "derives the real per-gram cost ... ignoring the client costoBaseInsumos"; `CostoInsumoService.test.ts` anti-forgery | ✅ COMPLIANT |
| 2.2 | Gramos ausentes o inválidos rechazados (422) | `CreateRegistroUseCase.test.ts` > "rejects a POR_GRAMO line without grams (422) and persists nothing"; `finanzas.schema.test.ts` rejects 0/neg (shape → 400) | ⚠️ PARTIAL (semantic 422 ✅, shape 400) |
| 2.3 | Snapshot auditables de gramos y precio | `CreateRegistroUseCase.test.ts` asserts `costoBaseInsumos:114000, gramosUsados:95, precioPorGramo:1200` | ✅ COMPLIANT |
| 3.1 | Comisión registro 182 = 201600 | `CostoInsumoService.test.ts` > "registro 182 commission (450000 − 114000) × 60% = 201600" | ✅ COMPLIANT |
| 3.2 | Insumos > total → comisión 0 | `CostoInsumoService.test.ts` > "never produce a negative commission" | ✅ COMPLIANT |
| 4.1 | P&L y resumen usan el costo real (114000) | `PyLMensualUseCase.test.ts` + `ResumenDiaUseCase.test.ts` | ✅ COMPLIANT |
| 4.2 | Múltiples líneas POR_GRAMO (150000) | `PyLMensualUseCase.test.ts` + `ResumenDiaUseCase.test.ts` (114000+36000) | ✅ COMPLIANT |
| 5.1 | FIJO ignora gramos | `CreateRegistroUseCase.test.ts` > "FIJO ignores gramosUsados and keeps the catalog cost" | ✅ COMPLIANT |
| 5.2 | Item legacy se lee sin cambios | `RegistroServicioItemDTO.test.ts` legacy nulls, original cost preserved (DTO-level; no HTTP harness) | ✅ COMPLIANT |

#### Capability: `servicio-items`
| # | Scenario | Test | Result |
|---|----------|------|--------|
| 1.1 | Persist items on registration | `CreateRegistroUseCase.test.ts` > "should persist serviciosItems when provided" | ✅ COMPLIANT |
| 1.2 | Persist gram snapshot on POR_GRAMO | `CreateRegistroUseCase.test.ts` > derives real cost / snapshot assertions | ✅ COMPLIANT |
| 1.3 | Empty serviciosItems | `CreateRegistroUseCase.test.ts` > "should not create servicio items when empty" — assertion checks the **mock fixture** (`mockSaved.serviciosItems`), not production output | ⚠️ PARTIAL |
| 2.1 | DTO includes items | `RegistroServicioItemDTO.test.ts` mapping asserts all snapshot columns | ✅ COMPLIANT |
| 2.2 | DTO exposes gram snapshot | `RegistroServicioItemDTO.test.ts` > "should expose the POR_GRAMO gram/price snapshot" | ✅ COMPLIANT |
| 2.3 | Legacy item keeps null gram fields | `RegistroServicioItemDTO.test.ts` > "should keep null gram fields for legacy items" | ✅ COMPLIANT |

#### Capability: `servicios-crud`
| # | Scenario | Test | Result |
|---|----------|------|--------|
| 1.1 | Happy path — create 201 | `ServicioController.test.ts` > create 201 (use case mocked) | ✅ COMPLIANT |
| 1.2 | Wrong categoria's salon → 422 | no covering test in changed set (pre-existing path, `ValidationError`=400) | ❌ UNTESTED |
| 1.3 | Missing required fields → 422 | no covering test in changed set (pre-existing, `ValidationError`=400) | ❌ UNTESTED |
| 1.4 | Create POR_GRAMO (201 + fields) | `servicios.schema.test.ts`; `CreateServicioUseCase.test.ts`; `ServicioController.test.ts` | ✅ COMPLIANT |
| 1.5 | Create POR_GRAMO without price → 422 | `servicios.schema.test.ts` rejects; HTTP actually **400** | ⚠️ PARTIAL |
| 2.1 | Update happy path | `UpdateServicioUseCase.test.ts` > "update parcial de precioBase sigue funcionando" | ✅ COMPLIANT |
| 2.2 | Update costoBaseInsumos | use case passes it through (`UpdateServicioUseCase.ts:68`), but no dedicated assertion | ⚠️ PARTIAL |
| 2.3 | Update a POR_GRAMO | `UpdateServicioUseCase.test.ts` > "cambia a POR_GRAMO con precio y lo persiste" | ✅ COMPLIANT |
| 2.4 | POR_GRAMO sin precio al actualizar → 422 | `UpdateServicioUseCase.test.ts` > "POR_GRAMO sin precio positivo es rechazado y no persiste" (real 422) | ✅ COMPLIANT |
| 3.1 | List expone el modo de costo | `ServicioDTO.test.ts` POR_GRAMO numeric mapping | ✅ COMPLIANT |
| 3.2 | Servicio legacy | `ServicioDTO.test.ts` > legacy → FIJO/null | ✅ COMPLIANT |

#### Capability: `finanzas-registros`
| # | Scenario | Test | Result |
|---|----------|------|--------|
| 1.1 | serviciosItems validation passes | `finanzas.schema.test.ts` > "should accept valid serviciosItems array" | ✅ COMPLIANT |
| 1.2 | serviciosItems with costoBaseInsumos preserved | no dedicated schema assertion (base already lacked it) | ⚠️ PARTIAL |
| 1.3 | serviciosItems with invalid data fails | `finanzas.schema.test.ts` rejects servicioId 0 / empty nombre / negative price | ✅ COMPLIANT |
| 1.4 | Cantidad inválida rechazada | `finanzas.schema.test.ts` rejects 0 / −1 / 1.5 | ✅ COMPLIANT |
| 1.5 | Gramos aceptados en la línea | `finanzas.schema.test.ts` > "should accept gramosUsados > 0 and preserve it" | ✅ COMPLIANT |
| 2.1 | Una línea ×2 | `CreateRegistroUseCase.test.ts` > "expands a line with cantidad=N into N item rows" (2 rows, totalServicios 40000) | ✅ COMPLIANT |
| 2.2 | Dos servicios distintos | `CreateRegistroUseCase.test.ts` > 2-service test (totalServicios 85000 recomputed) | ✅ COMPLIANT |
| 2.3 | Cantidades mixtas ×2 + ×3 = 5 rows / 130000 | no dedicated mixed-quantity test (mechanism covered by ×N loop + multi-line sum) | ⚠️ PARTIAL |
| 2.4 | Comisión refleja la cantidad | `CreateRegistroUseCase.test.ts` asserts `calcularComision(40000, 60, 10000)` | ✅ COMPLIANT |
| 3.1 | Costo forjado por el cliente descartado | `CreateRegistroUseCase.test.ts` > assert `costoBaseInsumos:114000` + `calcularComision(450000,60,114000)` | ✅ COMPLIANT |
| 3.2 | POR_GRAMO sin gramos → 422, nada persistido | `CreateRegistroUseCase.test.ts` > "rejects ... (422) and persists nothing" (`registroRepo.create` not called) | ✅ COMPLIANT |
| 3.3 | FIJO mantiene su costo | `CreateRegistroUseCase.test.ts` > "FIJO ignores gramosUsados and keeps the catalog cost" | ✅ COMPLIANT |

#### Capability: `agenda-citas`
| # | Scenario | Test | Result |
|---|----------|------|--------|
| 1.1 | List citas filtered by usuario/estado | `CitaController.test.ts` > "should pass query filters" (controller-level; no `ListCitasUseCase` unit test) | ⚠️ PARTIAL |
| 1.2 | Get cita by ID includes servicios | `CitaController.test.ts` get + `CitaDTO.test.ts` | ✅ COMPLIANT |
| 1.3 | Get cita exposes cantidad | `CitaDTO.test.ts` maps `cantidad` and Σ duration | ✅ COMPLIANT |
| 2.1 | Create cita successfully (legacy `serviciosIds`) | `CitaController.test.ts` create + normalize; `agenda.schema.test.ts` legacy | ✅ COMPLIANT |
| 2.2 | Create cita con cantidad | `CreateCitaUseCase.test.ts` > persists `cantidad`; `AgendaPage.test.tsx` create ×2 sends `servicios` | ✅ COMPLIANT |
| 2.3 | Reject creation on overlap → **409** | `CreateCitaUseCase.test.ts` throws `UnprocessableEntityError` → **422** (pre-existing at merge-base) | ⚠️ PARTIAL |
| 2.4 | Overlap usa la duración expandida | `CreateCitaUseCase.test.ts` > "expande la duración con cantidad: 150"; `DisponibilidadService.test.ts` > "60min×2 choca 11:30" | ✅ COMPLIANT |
| 2.5 | Validate cliente and usuario existence → 404 | `CreateCitaUseCase.test.ts` NotFoundError (cliente + usuario) | ✅ COMPLIANT |
| 2.6 | Cantidad inválida rechazada (422) | `agenda.schema.test.ts` rejects 0/negative (shape → HTTP **400**) | ⚠️ PARTIAL |
| 3.1 | Completar cita con cantidad ×2 | `CompletarCitaCantidad.test.ts` (real `CreateRegistroUseCase`: 2 rows, totalServicios 40000; ×3/×1 triangulated) + `AgendaPage.test.tsx` | ✅ COMPLIANT |
| 3.2 | Cita legacy sin cantidad | `CitaDTO.test.ts` legacy cantidad=1; `CitaController.test.ts` legacy `serviciosIds` → cantidad 1 | ✅ COMPLIANT |

**Compliance summary**: 38 ✅ COMPLIANT · 11 ⚠️ PARTIAL · 2 ❌ UNTESTED (51 scenarios).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Anti-forgery: server derives `POR_GRAMO` cost | ✅ Implemented | `CreateRegistroUseCase.ts:89-134` resolves catalog and **ignores** `si.costoBaseInsumos` for `POR_GRAMO`; derives via `CostoInsumoService.calcularCostoLinea` (`gramos × precio`). Not reachable from client cost. |
| `ComisionService` formula unchanged | ✅ Implemented | `git diff 25635aa HEAD -- .../ComisionService.ts` is empty. Formula `max(0, total − cost) × %` intact. |
| Server recomputes `totalServicios` when items present | ✅ Implemented | `CreateRegistroUseCase.ts:143-146` (`Σ precio × cantidad`); legacy path keeps payload when no items. |
| Per-gram snapshot persisted | ✅ Implemented | item entity + `RegistroServicioItemEntity` cols; `costoBaseInsumos = costoUnitario`. |
| Cita duration = Σ(duracion × cantidad), overlap uses it | ✅ Implemented | `CreateCitaUseCase.ts:66-70`, `DisponibilidadService.ts:85-93,143-150`, `CitaDTO.ts:37-40`. |
| `cantidad` persists on `citas_servicios` | ✅ Implemented | `CitaServicioEntity` PK `(citasId, serviciosId)` + `cantidad`; live DB matches. |
| Reports read persisted real cost | ✅ Implemented | `PyLMensualUseCase.ts:144-148`, `ResumenDiaUseCase.ts:139-140` sum `serviciosItems[].costoBaseInsumos`. |
| FIJO ignores grams; legacy reads | ✅ Implemented | `CreateRegistroUseCase.ts:119-133` forces `gramosUsados/precioPorGramo = null`, uses catalog `costoBaseInsumos`. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| #1 Grams per unit; N units → N identical rows | ✅ Yes | `CreateRegistroUseCase.ts:319-331`, tested. |
| #2 Explicit `CitaServicioEntity` on `citas_servicios` (composite PK + cantidad) | ✅ Yes | Entity + migration 016; live table untouched except additive `cantidad`. |
| #3 `totalServicios` recompute when items exist; empty → payload | ✅ Yes | `CreateRegistroUseCase.ts:143-146`. |
| #4 Grams: Zod shape + use-case semantic (422) | ✅ Yes | `finanzas.schema.ts:55`, `CreateRegistroUseCase.ts:93-101`. |
| #5 Single cost point (`CostoInsumoService`) | ✅ Yes | Injected once; `CostoInsumoService` registered in `container.ts:298`. |
| Migration impact: additive only, live names `citasId/serviciosId`, no rename | ✅ Yes | Verified against live DB; 2 legacy rows preserved. |
| Deviations from design (documented) | ✅ Accepted | 3 slice-owned migrations (014/015/016); frontend keeps `serviciosCantidades` map; design corrected in commit `c91877f`. |

### TDD Compliance (Strict TDD)
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ | Full `TDD Cycle Evidence` table exists for **PR3 only**; PR1/PR2 reported as completed tasks + commits without a per-task cycle table. |
| All tasks have tests | ✅ | 32/33 tasks have covering tests; `4.1` is docs-only. |
| RED confirmed (tests exist) | ✅ | Every test file cited in apply-progress exists; PR2 added 4 targeted cases to `CreateRegistroUseCase.test.ts`, PR3 added new suites. |
| GREEN confirmed (tests pass) | ✅ | Change-scoped tests all pass within 588/593 (5 pre-existing) and 355/357 single-thread (2 pre-existing). |
| Triangulation adequate | ⚠️ | Strong ×N triangulation (2/3/1, 60×2/30×3, round2). Gaps: mixed quantities 2+3, schema `costoBaseInsumos` preservation, cita filter use case. |
| Safety Net for modified files | ⚠️ | Claimed in apply-progress; not independently reproducible from the artifact alone. |

**TDD Compliance**: 3/6 checks fully green, 3 partial. No CRITICAL TDD violation (tests exist and pass).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (API) | change-scoped suites within 593 | ~20 API test files | vitest |
| Unit (zod schemas) | 4 suites (`servicios`, `agenda`, `finanzas`, DTOs) | 4 | vitest |
| Integration (API) | `CompletarCitaCantidad.test.ts` wires real `CreateRegistroUseCase` behind `CompletarCitaUseCase` | 1 | vitest |
| Integration (RTL) | `WalkInModal`, `ServiciosPage`, `AgendaPage` | 3 | @testing-library/react |
| E2E | 0 | 0 | not installed |
| **Total** | change-scoped | 22 files changed/created | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (no `--coverage` provider configured).

### Assertion Quality
| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `apps/api/.../registro/__tests__/CreateRegistroUseCase.test.ts` | 498 | `expect(mockSaved.serviciosItems).toEqual([])` | Asserts the mocked fixture, not production output — would pass even if items were created. **Pre-existing test** (present at merge-base). | WARNING |

**Assertion quality**: 0 CRITICAL, 1 WARNING (pre-existing). No tautologies (`expect(true).toBe(true)`), no ghost loops over `querySelectorAll`, no type-only-only assertions in change-scoped tests. `CompletarCitaCantidad.test.ts` is mock-heavy (integration wiring) but its 9 assertions are behavioral (row counts, prices, totals).

### Quality Metrics
**Linter**: ➖ Not available/not configured for changed files.
**Type Checker**: ❌ 1 error (`seed.ts(238)`), pre-existing baseline; no new errors attributable to this change.

### Issues Found

**CRITICAL**: None.
The core anti-forgery invariant is implemented server-side and proven by tests: for `POR_GRAMO`, the client `costoBaseInsumos` never reaches persistence or the commission base — the server derives `gramos × precioPorGramo` from the catalog (`CreateRegistroUseCase.ts:93-116`) and a test asserts both the persisted value (`114000`) and the commission call (`450000, 60, 114000`).

**WARNING**
- **W1 (migrations vs synchronized prod)**: Migrations `1700000000014/015/016` are additive and each has a proper `down()`. They are safe **only while `DB_SYNCHRONIZE=true`** (the documented prod config), because `database.ts:21` disables `migrationsRun` then and `synchronize` applies the columns. If someone ever runs migrations against the already-synchronized prod DB, `ADD COLUMN` would fail on duplicate columns (not idempotent; no `IF NOT EXISTS`). This mirrors the pre-existing migration strategy, but it is a real deploy footgun to document.
- **W2 (flaky pre-existing dashboard test)**: `AgendaPage.test.tsx > C3 quick-add cliente` fails under default parallel full-suite (line 396, `clientesGets().length` timeout) but passes 30/30 in isolation and the full suite is baseline-clean (2 failures) with `--no-file-parallelism`. The test is pre-existing (present at merge-base) and unrelated to quantity/grams; classify as test-isolation flake, not a functional regression.
- **W3 (spec status vs platform convention)**: Delta specs specify `422 ValidationError` for shape-level rejection, but the API's `ValidationError` is `400` (`errors.ts:51-54`). So `create POR_GRAMO without price`, `cita cantidad=0`, and `gramosUsados=0` actually return **400**, while semantic rejections (missing grams on `POR_GRAMO`, update-to-`POR_GRAMO` without price) correctly return **422**. The functional rule (reject, not persist) holds; only the status code differs. Pre-existing convention.
- **W4 (overlap 409 vs 422)**: Spec scenario says overlap → `409`, but `CreateCitaUseCase` throws `UnprocessableEntityError` (422). Confirmed pre-existing at merge-base (unchanged line). Out of scope of this change.
- **W5 (TDD evidence partial)**: apply-progress carries a per-task TDD cycle table for PR3 only; PR1/PR2 have commit/task lists but no RED/GREEN/TRIANGULATE table. Tests do exist and pass, so this is a reporting gap.
- **W6 (task 4.1 incomplete)**: `AGENTS.md` gotchas for `tipoCostoInsumo`/quantity/join naming were not written. Cleanup task → WARNING.

**SUGGESTION**
- **S1**: Add a mixed-quantity test (`cantidad:2` + `cantidad:3` → 5 rows, `totalServicios=130000`, commission on total−cost) to close the `Cantidades mixtas` scenario with a direct assertion.
- **S2**: Add a dedicated schema assertion that an explicit `costoBaseInsumos` is preserved by `createRegistroSchema.parse`.
- **S3**: Replace the pre-existing fixture assertion at `CreateRegistroUseCase.test.ts:498` with `expect(mockRepoCreate).not.toHaveBeenCalled()` (or assert no item repo interaction).
- **S4**: Consider a `ConflictError` (409) mapping for cita overlap if the spec's 409 is intentional; otherwise correct the spec to 422.

### Verdict
**PASS WITH WARNINGS**

All core behaviors are implemented server-side and proven by passing tests. The critical anti-forgery invariant (client-supplied `costoBaseInsumos` cannot shrink the `POR_GRAMO` commission base) is airtight and tested; commission formula, quantity expansion, cita `cantidad`, duration/overlap math, additive migrations (verified against the live prod-copy schema), and report consumption of the persisted real cost all pass. Warnings are pre-existing platform/spec-status conventions, a pre-existing flaky test, one incomplete docs task, and minor test triangulation gaps — none block archiving. Recommended before archive: decide on W3/W4 status-code spec wording, complete task 4.1, and optionally close S1–S3.

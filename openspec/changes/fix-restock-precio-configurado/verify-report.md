# Verification Report: fix-restock-precio-configurado

- **Change**: `fix-restock-precio-configurado`
- **Mode**: Strict TDD (vitest) — active; hybrid persistence (OpenSpec file + Engram)
- **Worktree**: `/home/hellhammer/Escritorio/proyectos/pos-final-wt/restock`
- **Branch**: `feat/fix-restock-precio-configurado` @ `75b12a5`
- **Commits**: `faf0b1d`, `9d0a6e7`, `7c76c18`, `75b12a5` (base `a3fa7f2`)
- **Verdict**: **BLOCKED / FAIL**

---

## 1. Completeness

| Item | Result |
|---|---|
| Tasks in `tasks.md` | 21/21 marked `[x]` |
| Spec requirements (ADDED 3 / MODIFIED 3) | All have implementation; 2 scenarios lack a behavioral test |
| Diff size | 22 files, 857 additions / 68 deletions = **925 changed lines** |

---

## 2. Command Evidence (actual output)

### 2.1 API test suite
```
cd apps/api && npx vitest run
 Test Files  1 failed | 89 passed (90)
      Tests  5 failed | 659 passed (664)
      Duration  18.62s
```
All 5 failures are the known date-dependent baseline in
`src/modules/finanzas/application/use-cases/liquidacion/__tests__/NominaPendienteUseCase.test.ts`.
Baseline match: `≈623 passed / 5 known` → **659 passed / 5 known**. ✅

Targeted new tests (8 files, 54 tests) all green:
```
 ✓ ProductoDTO.test.ts (4)   ✓ ProductoController.test.ts (9)
 ✓ catalogo.schema.test.ts (13)  ✓ tipoPrecioBackfill.test.ts (4)
 ✓ RestockProductoUseCase.test.ts (4)  ✓ CreateProductoUseCase.test.ts (7)
 ✓ UpdateProductoUseCase.test.ts (11)  ✓ ProductoEntity.test.ts (2)
 Test Files  8 passed (8)   Tests  54 passed (54)
```

### 2.2 API type-check
```
npx tsc --noEmit
src/infrastructure/persistence/seed.ts(238,23): error TS2769: No overload matches this call.
API_TSC_EXIT=2
```
Only the known baseline `seed.ts` error. ✅

### 2.3 Dashboard test suite
```
cd apps/pos-dashboard && npx vitest run
 Test Files  2 failed | 32 passed (34)
      Tests  2 failed | 414 passed (416)
```
Failures:
1. `src/__tests__/mobileBottomSheet.test.ts` — reproduced on base `a3fa7f2` (baseline). ✅
2. `src/pages/__tests__/AgendaPage.test.tsx` — passes **in isolation** (`37 passed`) and passes on base; flaky under full parallel load. Neither file is in the branch diff.
Targeted: `ProductosPage.test.tsx` → **17 passed**.

### 2.4 Dashboard type-check
```
npx tsc --noEmit
DASH_TSC_EXIT=0
```
✅ 0 errors.

### 2.5 Validation package
`packages/validation/dist/catalogo.schema.js` rebuilt and contains:
```
tipoPrecio: z.enum(['FIJO', 'MARGEN']).default('MARGEN')
if (data.tipoPrecio === 'FIJO' && !(data.precioVenta && data.precioVenta > 0)) { … }
```
Worktree override present: `apps/api/node_modules/@pos-final/validation -> ../../../../packages/validation` (worktree). ✅

### 2.6 Backfill — real MySQL execution
Raw SQL (exact string from the module) against a scratch DB seeded with 4 rows:
```
FIRST RUN  -> affected_first = 2   (id1 pc=0/pv=500 -> FIJO; id4 pc=0/pv=1200 -> FIJO)
            id2 pc=0/pv=0 MARGEN; id3 pc=100/pv=260 MARGEN
SECOND RUN -> affected_second = 0  (idempotent)
```

### 2.7 Backfill — real prod path (`DB_SYNCHRONIZE=true`, migrations skipped)
With the new entity test file temporarily moved aside:
```
[04:37:06] INFO  tipoPrecio backfill completed
[04:37:06] INFO  🚀 Server listening on port 3099
DB AFTER BOOT: legacyA(0,500)->FIJO | legacyB(0,0)->MARGEN | legacyC(100,260)->MARGEN
SECOND BOOT: backfill completed (no error, affected 0)
```
So the synchronize-adds-column → backfill order is correct and idempotent. **But see CRITICAL-1: as committed, the server never reaches this code.**

---

## 3. Spec Compliance Matrix

| Requirement / Scenario | Covering test / evidence | Status |
|---|---|---|
| **Create persists mode** | `catalogo.schema.test.ts:49-70` + `CreateProductoUseCase.test.ts:146-167` | PASS |
| Update persists mode | `UpdateProductoUseCase.test.ts:197-211` | PASS |
| Backfill existing data | `tipoPrecioBackfill.test.ts` + real MySQL §2.6 | PASS |
| Restock FIJO unchanged, PMP updates | `RestockProductoUseCase.test.ts:61-79` | PASS |
| MARGEN recomputes | `RestockProductoUseCase.test.ts:81-92` | PASS |
| FIJO explicit new price | `RestockProductoUseCase.test.ts:94-105` | PASS |
| Create happy path / missing fields / FIJO requires price | `catalogo.schema.test.ts` + controller tests | PASS |
| Update FIJO not recalculated | `UpdateProductoUseCase.test.ts:170-183` | PASS |
| **Reabastecer: precioVenta untouched** | No behavioral test. Code: `ReabastecerStockUseCase.ts:25` → `incrementStock` only writes `cantidadStock`/`precioCompra` (`TypeORMProductoRepository.ts:102-105`). Controller test mocks the UC and asserts only status 200. | **UNTESTED (CRITICAL per strict TDD)** |
| **Sale snapshot uses current precioVenta** | No test. Code: `CreateRegistroUseCase.ts:281` reads `Number(producto.precioVenta)` (file untouched by diff). | **UNTESTED (CRITICAL per strict TDD)** |

---

## 4. Trap Verification (requested checks)

| Trap | Result | Evidence |
|---|---|---|
| `tipoPrecio` persisted, in DTO/validation, drives create/update/restock | ✅ PASS | `ProductoEntity.ts:73-74`; `ProductoDTO.ts:18,44`; `catalogo.schema.ts:81,95-105,124-127`; Create/Update/Restock use cases branch on it |
| FIJO restock does not overwrite `precioVenta`; MARGEN recomputes; PMP still updates `precioCompra` | ✅ PASS | `RestockProductoUseCase.ts:46-49`; `TypeORMProductoRepository.ts:114-118` writes `nuevoPrecioCompra` |
| Frontend uses persisted `tipoPrecio`, heuristic removed, FIJO shows fixed-price field | ✅ PASS | `ProductosPage.tsx`: `priceMode` gone (grep = none), `isMargin = prod.tipoPrecio==='MARGEN'` (:692), FIJO price input (:1042-1045), restock preview (:412-420), explicit price field (:1219) |
| Backfill targets `precioCompra=0 AND precioVenta>0`, idempotent, works with `DB_SYNCHRONIZE=true` | ⚠️ Functionally PASS, **blocked by CRITICAL-1** | §2.6, §2.7 |
| `ReabastecerStock` only touches `precioCompra` | ✅ PASS (code) / UNTESTED scenario | `TypeORMProductoRepository.ts:102-105` |

## 5. Regression Scan

- Sale snapshot still reads `producto.precioVenta`: `CreateRegistroUseCase.ts:281` — file not in diff. ✅
- `git diff a3fa7f2..HEAD` touches only `catalogo`, validation, `ProductosPage`, `productoService`, `shared/database`, `shared` entity, migration/backfill. No changes to `finanzas`, `agenda`, or `container.ts`. ✅

---

## 6. TDD Compliance (Strict TDD)

| Check | Result | Details |
|---|---|---|
| TDD Cycle Evidence reported | ✅ | apply-progress has a full table for 21 tasks |
| All tasks have tests | ✅ | 10 distinct test files, all exist and pass |
| RED confirmed (tests exist) | ✅ | 10/10 files present |
| GREEN confirmed (tests pass on execution) | ✅ | 54/54 API new tests + 17/17 dashboard pass |
| Triangulation adequate | ✅ | FIJO/MARGEN/explicit/ignore/rounding/default across suites |
| Safety Net for modified files | ✅ | `catalogo.schema.test.ts`, `ProductoDTO.test.ts`, Create/Update UC tests report existing suites as safety net |

**Assertion quality**: ✅ No tautologies, no ghost loops, no type-only or implementation-detail assertions. Assertions verify real behavior (persisted payloads, computed prices, DB state).

---

## 7. Issues

### CRITICAL-1 — API cannot boot: entity glob loads the new test file
`apps/api/src/shared/database.ts:23` sets
```
entities: [__dirname + '/../infrastructure/persistence/entities/**/*.{ts,js}']
```
This change adds the **first-ever** test file under that directory:
`apps/api/src/infrastructure/persistence/entities/__tests__/ProductoEntity.test.ts`.
TypeORM imports it at startup, which `require()`s `vitest` inside a CommonJS module, throwing before MySQL connects.

Actual output of the real entrypoint (`cd apps/api && npx tsx src/server.ts`, scratch DB, `DB_SYNCHRONIZE=true`):
```
INFO  Connecting to MySQL...
ERROR Failed to connect to MySQL
  component: "database"
  err.message: "Vitest cannot be imported in a CommonJS module using require()…"
  stack: … at Object.<anonymous> (…/entities/__tests__/ProductoEntity.test.ts:2:38)
EXIT_CODE=1
```
Causation proven: with the test file moved aside, the same command boots (`creating a new table…`, then listened on 3099). File was restored exactly afterwards. `git status` clean.

**Impact**: production/dev API process exits(1) at boot on this branch. This also means the backfill never runs in practice. All vitest/tsc gates are green, so this is invisible to the current verification commands.

**Suggested fix (for the orchestrator/author)**: exclude tests from the entity glob (e.g. `entities/**/*.entity.{ts,js}` or filter `__tests__`/`.test.`), or move `ProductoEntity.test.ts` out of `src/infrastructure/persistence/entities/`.

### CRITICAL-2 (Strict TDD) — Spec scenarios without a passing covering test
- `Reabastecer Stock` → "precioVenta untouched": no behavioral test; the existing controller test mocks the use case and asserts only 200.
- `Sale Price Snapshot Stability` → "Snapshot uses configured fixed price": no test exercising a FIJO product restock → sale snapshot.

Both cover unchanged/working behavior, but Strict TDD (`sdd-verify` gate: "Spec scenario has no passing covering test → CRITICAL UNTESTED") marks them as failures.

### WARNING-1 — Diff exceeds review budget
Actual **925 lines** (`857 + 68`) > 800-line ceiling (and > the 400-line default). Flagged, not blocking.

### WARNING-2 — Backfill predicate can re-classify future MARGEN products
`tipoPrecioBackfill` runs on every startup with `WHERE tipoPrecio='MARGEN' AND precioCompra=0 AND precioVenta>0`. A user who deliberately creates/keeps a **MARGEN** product with cost 0 and an explicit sale price will be silently flipped to `FIJO` on the next restart. The predicate matches the spec/design exactly (accepted open question), so this is a behavioral risk to note, not a spec violation.

### SUGGESTION-1 — Stale comment
`database.ts:7` still says "synchronize: false — all schema changes go through migrations", contradicted by `:17`. Pre-existing, but now more confusing next to the backfill logic.

### SUGGESTION-2 — Add integration coverage
Add a `ReabastecerStockUseCase` behavioral test (precioVenta untouched) and a `CreateRegistroUseCase` product-snapshot test to satisfy the two UNTESTED scenarios.

---

## 8. Verdict

**BLOCKED (FAIL)** — CRITICAL-1 (API boot failure) prevents the change from shipping; CRITICAL-2 marks two spec scenarios UNTESTED under Strict TDD. Everything else (schema, use cases, frontend, backfill logic, type-checks, suites) verifies green.

# Tasks: fix-restock-precio-configurado

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~590 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 Foundation → PR 2 API behavior → PR 3 Frontend |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

**Resolved before apply**: single PR, maintainer-accepted under the raised review
budget (actual ~590 changed lines < 800). No chain. Commits are grouped as
reviewable work units (foundation → API behavior → frontend).

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Persistence contract (entity, migration, backfill, validation, DTO) + tests | PR 1 | base = main; autonomous |
| 2 | API behavior (create/update/restock use cases + controller) + tests | PR 2 | base = PR 1 branch; depends on PR 1 |
| 3 | Frontend reads/writes `tipoPrecio` + tests | PR 3 | base = PR 2; depends on PR 1 |

## Phase 1: Foundation (PR 1)

- [x] 1.1 `ProductoEntity.ts`: add `export enum TipoPrecio { FIJO, MARGEN }` and `@Column({ type:'varchar', length:10, default:'MARGEN' }) tipoPrecio`.
- [x] 1.2 Create `migrations/1700000000017-AddTipoPrecioProductos.ts`: additive `ADD COLUMN tipoPrecio VARCHAR(10) NOT NULL DEFAULT 'MARGEN'`; `down()` drops it.
- [x] 1.3 RED: test `tipoPrecioBackfill.test.ts` — SQL filters `MARGEN AND precioCompra=0 AND precioVenta>0`; fake `{query}` returns affectedRows; idempotent no-op.
- [x] 1.4 GREEN: create `backfill/tipoPrecioBackfill.ts` (`TIPO_PRECIO_BACKFILL_SQL`, `backfillTipoPrecio(ds=AppDataSource)`); wire into `initializeDatabase()`; fail-safe.
- [x] 1.5 RED/GREEN: `catalogo.schema.test.ts` — extract `productoBaseSchema`; `createProductoSchema = base.superRefine(FIJO ⇒ precioVenta>0)`; `updateProductoSchema = base.partial()`; `restockProductoSchema` + optional `precioVenta`.
- [x] 1.6 `ProductoDTO.ts` `+tipoPrecio` + mapping; `IProductoRepository.ts` unchanged; DTO test.
- [x] 1.7 Rebuild validation: `cd packages/validation && npx tsc`.

## Phase 2: API Behavior (PR 2)

- [x] 2.1 RED: `CreateProductoUseCase.test.ts` — FIJO persists verbatim, MARGEN derives, default MARGEN.
- [x] 2.2 GREEN: `CreateProductoUseCase.ts` — accept/store `tipoPrecio`, branch derivation.
- [x] 2.3 RED: `UpdateProductoUseCase.test.ts` — FIJO ignores cost change; mode persisted; MARGEN recomputes.
- [x] 2.4 GREEN: `UpdateProductoUseCase.ts` — effective mode branch (`:63-72`).
- [x] 2.5 RED: new `RestockProductoUseCase.test.ts` (mock `shared/database.js`) — FIJO keeps `precioVenta`, PMP updates; MARGEN recomputes; FIJO explicit price honored.
- [x] 2.6 GREEN: `RestockProductoUseCase.ts` branch (`:40-41`); add `precioVenta?` to input; `ProductoController.restock` passes `req.body.precioVenta`.
- [x] 2.7 TRIANGULATE: FIJO with `precioCompra=0`, rounding, explicit-price ignored on MARGEN.

## Phase 3: Frontend (PR 3)

- [x] 3.1 RED: `ProductosPage.test.tsx` — create FIJO sends `tipoPrecio` + explicit `precioVenta`; edit uses persisted mode; FIJO restock preview keeps price + shows price field.
- [x] 3.2 GREEN: `productoService.ts` — `Producto.tipoPrecio`, create payload, `restockProducto` optional `precioVenta`.
- [x] 3.3 GREEN: `ProductosPage.tsx` — replace `priceMode` heuristic with `form.tipoPrecio` (`:211,321-327,683-689`); payload (`:337-355`); `restockPreview`/labels (`:404-415,1228-1240`); `handleStockAction`.
- [x] 3.4 TRIANGULATE: MARGEN regression, FIJO with `precioCompra=0`, explicit-price restock.

## Phase 4: Verification

- [x] 4.1 `cd apps/api && npx vitest run` + `npx tsc --noEmit` (baseline 1 known `seed.ts` error).
- [x] 4.2 `cd apps/pos-dashboard && npx vitest run` + `npx tsc --noEmit` (baseline ≤2 known).
- [x] 4.3 Document backfill (`UPDATE productos SET tipoPrecio='FIJO' WHERE precioCompra=0 AND precioVenta>0`) and rollback in PR body.

## Phase 5: Post-Verify Remediation (fixes `verify-report.md` CRITICAL-1 / CRITICAL-2)

- [x] 5.1 CRITICAL-1 — exclude `*.test`/`*.spec` from the TypeORM entity glob in `apps/api/src/shared/database.ts` (`entities/**/!(*.test|*.spec).{ts,js}`); prove `npx tsx src/server.ts` boots to `🚀 Server listening`.
- [x] 5.2 CRITICAL-2a — behavioral tests proving `ReabastecerStock` leaves `precioVenta` untouched (`ReabastecerStockUseCase.test.ts` UC contract + `TypeORMProductoRepository.test.ts` persistence invariant); mutation-verified.
- [x] 5.3 CRITICAL-2b — behavioral test proving a FIJO sale snapshots the configured `precioVenta`, not a margin-derived value (`CreateRegistroUseCase.test.ts`); mutation-verified.
- [x] 5.4 Re-run gates: API 667 passed / 5 known date-dependent; dashboard 415 passed / 1 known; API `tsc` 1 known (`seed.ts`); dashboard `tsc` 0.

## Backfill / Rollback (PR body)

**Backfill (runs automatically at API startup).** Production runs with
`DB_SYNCHRONIZE=true`, so migrations are skipped and the sync-added column
defaults every legacy row to `MARGEN`. `initializeDatabase()` calls
`backfillTipoPrecio()` once after connecting to flip rows that had a fixed
price but no cost. Idempotent — re-running matches zero rows. The equivalent
one-time SQL is:

```sql
UPDATE productos SET tipoPrecio='FIJO' WHERE tipoPrecio='MARGEN' AND precioCompra=0 AND precioVenta>0;
```

**Rollback.** Revert the mode to today's recompute-always behavior:

```sql
UPDATE productos SET tipoPrecio='MARGEN';
```

Then revert the use-case branch (`RestockProductoUseCase`, `UpdateProductoUseCase`)
and drop the additive column (`1700000000017-AddTipoPrecioProductos.down`).

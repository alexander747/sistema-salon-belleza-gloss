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

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Persistence contract (entity, migration, backfill, validation, DTO) + tests | PR 1 | base = main; autonomous |
| 2 | API behavior (create/update/restock use cases + controller) + tests | PR 2 | base = PR 1 branch; depends on PR 1 |
| 3 | Frontend reads/writes `tipoPrecio` + tests | PR 3 | base = PR 2; depends on PR 1 |

## Phase 1: Foundation (PR 1)

- [ ] 1.1 `ProductoEntity.ts`: add `export enum TipoPrecio { FIJO, MARGEN }` and `@Column({ type:'varchar', length:10, default:'MARGEN' }) tipoPrecio`.
- [ ] 1.2 Create `migrations/1700000000017-AddTipoPrecioProductos.ts`: additive `ADD COLUMN tipoPrecio VARCHAR(10) NOT NULL DEFAULT 'MARGEN'`; `down()` drops it.
- [ ] 1.3 RED: test `tipoPrecioBackfill.test.ts` — SQL filters `MARGEN AND precioCompra=0 AND precioVenta>0`; fake `{query}` returns affectedRows; idempotent no-op.
- [ ] 1.4 GREEN: create `backfill/tipoPrecioBackfill.ts` (`TIPO_PRECIO_BACKFILL_SQL`, `backfillTipoPrecio(ds=AppDataSource)`); wire into `initializeDatabase()`; fail-safe.
- [ ] 1.5 RED/GREEN: `catalogo.schema.test.ts` — extract `productoBaseSchema`; `createProductoSchema = base.superRefine(FIJO ⇒ precioVenta>0)`; `updateProductoSchema = base.partial()`; `restockProductoSchema` + optional `precioVenta`.
- [ ] 1.6 `ProductoDTO.ts` `+tipoPrecio` + mapping; `IProductoRepository.ts` unchanged; DTO test.
- [ ] 1.7 Rebuild validation: `cd packages/validation && npx tsc`.

## Phase 2: API Behavior (PR 2)

- [ ] 2.1 RED: `CreateProductoUseCase.test.ts` — FIJO persists verbatim, MARGEN derives, default MARGEN.
- [ ] 2.2 GREEN: `CreateProductoUseCase.ts` — accept/store `tipoPrecio`, branch derivation.
- [ ] 2.3 RED: `UpdateProductoUseCase.test.ts` — FIJO ignores cost change; mode persisted; MARGEN recomputes.
- [ ] 2.4 GREEN: `UpdateProductoUseCase.ts` — effective mode branch (`:63-72`).
- [ ] 2.5 RED: new `RestockProductoUseCase.test.ts` (mock `shared/database.js`) — FIJO keeps `precioVenta`, PMP updates; MARGEN recomputes; FIJO explicit price honored.
- [ ] 2.6 GREEN: `RestockProductoUseCase.ts` branch (`:40-41`); add `precioVenta?` to input; `ProductoController.restock` passes `req.body.precioVenta`.
- [ ] 2.7 TRIANGULATE: FIJO with `precioCompra=0`, rounding, explicit-price ignored on MARGEN.

## Phase 3: Frontend (PR 3)

- [ ] 3.1 RED: `ProductosPage.test.tsx` — create FIJO sends `tipoPrecio` + explicit `precioVenta`; edit uses persisted mode; FIJO restock preview keeps price + shows price field.
- [ ] 3.2 GREEN: `productoService.ts` — `Producto.tipoPrecio`, create payload, `restockProducto` optional `precioVenta`.
- [ ] 3.3 GREEN: `ProductosPage.tsx` — replace `priceMode` heuristic with `form.tipoPrecio` (`:211,321-327,683-689`); payload (`:337-355`); `restockPreview`/labels (`:404-415,1228-1240`); `handleStockAction`.
- [ ] 3.4 TRIANGULATE: MARGEN regression, FIJO with `precioCompra=0`, explicit-price restock.

## Phase 4: Verification

- [ ] 4.1 `cd apps/api && npx vitest run` + `npx tsc --noEmit` (baseline 1 known `seed.ts` error).
- [ ] 4.2 `cd apps/pos-dashboard && npx vitest run` + `npx tsc --noEmit` (baseline ≤2 known).
- [ ] 4.3 Document backfill (`UPDATE productos SET tipoPrecio='FIJO' WHERE precioCompra=0 AND precioVenta>0`) and rollback in PR body.

# Design: fix-restock-precio-configurado

## Technical Approach

Persist a per-product `tipoPrecio: 'FIJO' | 'MARGEN'` as the `precioVenta` source of truth. Create/update store it; restock branches on it — `MARGEN` recomputes `precioVenta = PMP × (1 + margenGanancia/100)`, `FIJO` keeps the configured price (or an explicit incoming one). Existing zero-cost/fixed-price rows are backfilled to `FIJO`. PMP still updates `precioCompra` on every restock.

## Architecture Decisions

| # | Decision | Choice | Why / rejected |
|---|---|---|---|
| 1 | Mode storage | `enum TipoPrecio { FIJO, MARGEN }` column, default `MARGEN` | Backwards-compatible default; legacy recompute behavior preserved for un-migrated rows. |
| 2 | Validation split | Plain `productoBaseSchema`; `createProductoSchema = base.superRefine(FIJO ⇒ precioVenta)`; `updateProductoSchema = base.partial()` | `.superRefine` returns `ZodEffects` (no `.partial()`). Same lesson as `servicioBaseSchema`. Update stays semantic in the use case. |
| 3 | FIJO restock | `nuevoPrecioVenta = input.precioVenta ?? Number(producto.precioVenta)` | Never clobbers configured price; MAY accept explicit new price. |
| 4 | MARGEN restock | Recompute from PMP × margin (unchanged math) | Zero behavior change for margin products. |
| 5 | Update mode resolution | `effective = input.tipoPrecio ?? producto.tipoPrecio`; explicit `precioVenta` wins; MARGEN recomputes on cost/margin change; FIJO leaves price | Single branch, no heuristic. |
| 6 | Backfill path | Idempotent `UPDATE ... WHERE tipoPrecio='MARGEN' AND precioCompra=0 AND precioVenta>0` invoked from `initializeDatabase()` | Prod runs `DB_SYNCHRONIZE=true` (migrations skipped), so the sync-added column defaults to `MARGEN` and needs an application-level backfill. |

## Data Model

| Table | Column | Type | Default | Backfill |
|---|---|---|---|---|
| `productos` | `tipoPrecio` | varchar(10) | `'MARGEN'` | `FIJO` where `precioCompra=0 AND precioVenta>0` |

Migration `1700000000017-AddTipoPrecioProductos.ts` — additive `ADD COLUMN tipoPrecio VARCHAR(10) NOT NULL DEFAULT 'MARGEN'`, `down()` drops it. Never rename/recreate (prod naming trap).

## Backfill

`apps/api/src/infrastructure/persistence/backfill/tipoPrecioBackfill.ts`:
```ts
export const TIPO_PRECIO_BACKFILL_SQL =
  "UPDATE productos SET tipoPrecio='FIJO' WHERE tipoPrecio='MARGEN' AND precioCompra=0 AND precioVenta>0";
export async function backfillTipoPrecio(ds = AppDataSource): Promise<number>; // returns affectedRows
```
Called once from `initializeDatabase()` after `AppDataSource.initialize()`. Idempotent (post-run rows are `FIJO`, excluded). Fail-safe: log error, do not crash startup. Rollback doc: `UPDATE productos SET tipoPrecio='MARGEN'`.

## API / DTO / Validation

| Surface | Change |
|---|---|
| `ProductoEntity` | `+tipoPrecio: TipoPrecio` |
| `ProductoDTO` | `+tipoPrecio: string`; mapped in `fromEntity` |
| `createProductoSchema` | `+tipoPrecio` (enum, default `MARGEN`); FIJO ⇒ `precioVenta > 0` required |
| `updateProductoSchema` | `.partial()` includes `tipoPrecio` / `precioVenta` |
| `restockProductoSchema` | `+precioVenta: z.number().positive().optional()` |
| `RestockProductoInput` (UC) | `+precioVenta?`; controller passes `req.body.precioVenta` |
| `IProductoRepository.RestockInput` | unchanged shape (`nuevoPrecioVenta` already carries result) |

## Frontend Flows (`apps/pos-dashboard/src/pages/ProductosPage.tsx`)

- Replace `priceMode` heuristic with `form.tipoPrecio` (`'FIJO' | 'MARGEN'`); `openEdit` reads persisted `prod.tipoPrecio` (`:211`, `:321-327`, `:683-689`).
- Payload (`:337-355`): always send `tipoPrecio`; `MARGEN` omits `precioVenta` when equal to suggestion; `FIJO` always sends explicit `precioVenta`.
- Margin input shown only for `MARGEN`; price input only for `FIJO`.
- `restockPreview` (`:404-415`) and modal labels (`:1228-1240`): `MARGEN` → computed `nuevoPV`; `FIJO` → `nuevoPV = precioVenta` (unchanged) with an optional explicit price field.
- `handleStockAction` restock sends `precioVenta` only when `FIJO` and provided.
- `productoService.ts`: `Producto` `+tipoPrecio`; create payload `+tipoPrecio`; restock payload `+precioVenta?`.

## Edge Cases

- Legacy row with `precioCompra>0` and manual price stays `MARGEN` (not backfilled) — accepted per proposal.
- FIJO restock with no explicit price keeps price and still writes PMP + historial.
- Explicit `precioVenta` on MARGEN restock is ignored (recompute wins).
- Sale snapshot unaffected: `RegistroProducto.precioVentaUnitario` reads current `precioVenta`.

## Testing Strategy (strict TDD, vitest)

| Layer | What | Approach |
|---|---|---|
| Schema | FIJO requires `precioVenta`; MARGEN default; restock optional `precioVenta` | `catalogo.schema.test.ts` |
| Unit | Create: FIJO persists + no recompute; MARGEN derives | mocked repo |
| Unit | Update: FIJO not recalculated; mode persisted; MARGEN recomputes | mocked repo |
| Unit | Restock: FIJO keeps price; MARGEN recomputes; FIJO explicit price | mocked `AppDataSource` (`vi.mock('shared/database.js')`) |
| Unit | DTO maps `tipoPrecio` | fixture |
| Unit | Backfill SQL + fake ds affectedRows | fake `{ query }` |
| Frontend | create FIJO payload; edit reads persisted mode; FIJO restock preview; FIJO price field | RTL + mocked api |

Commands: `cd apps/api && npx vitest run` + `npx tsc --noEmit` (baseline 1 known error: `seed.ts`); `cd packages/validation && npx tsc`; `cd apps/pos-dashboard && npx vitest run` + `npx tsc --noEmit` (baseline ≤2 known errors).

## Rollback / Backwards Compat

Additive column + migration `down`. Runtime rollback: set all `tipoPrecio='MARGEN'` (restores recompute-always) and revert the restock/update branch. Legacy rows read `MARGEN` until backfilled.

## Open Questions

- [ ] Should the backfill also cover `precioCompra>0` rows whose price ≠ derived margin? (Proposal says no.)

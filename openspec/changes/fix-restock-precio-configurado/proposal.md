# Proposal: fix-restock-precio-configurado

## Intent

Products can be priced either FIXED (`precioVenta` set directly) or by MARGIN %, but the mode is **not persisted**. "Re-stock inteligente" always recomputes `precioVenta = PMP × (1 + margenGanancia/100)` and **overwrites the configured fixed price**. Many products were also created with `precioCompra = 0` while a fixed `precioVenta` was set.

## Scope

- Persist a per-product price mode `tipoPrecio: FIJO | MARGEN` (source of truth) on create/update.
- Restock MUST branch on the mode: `MARGEN` recomputes from `margenGanancia`; `FIJO` MUST NOT clobber `precioVenta` (MAY accept an explicit new fixed price).
- Backfill existing data: products with `precioCompra = 0 && precioVenta > 0` are treated as `FIJO`.
- PMP still updates `precioCompra` on restock.
- Sales snapshot the current `precioVenta`; fixing the mode prevents unintended price changes flowing into future sales/reports.

**Non-goals**: stock valuation, changing P&L product-cost treatment, changing the sale-snapshot shape.

## Approach

Add an **additive** `tipoPrecio` column (`ADD COLUMN ... DEFAULT 'MARGEN'`) per repo migration rules (prod runs `DB_SYNCHRONIZE=true`, no migrations), plus a one-time backfill for zero-cost/fixed-price products. Add the mode branch in `RestockProductoUseCase`. Frontend stops inferring the mode heuristically and reads/writes `tipoPrecio`, showing the margin input only for `MARGEN` and the price input for `FIJO`.

## Rollback

Set all `tipoPrecio = 'MARGEN'` (restores today's recompute-always behavior) and revert the use-case branch.

import { AppDataSource } from '../../../shared/database';

/**
 * Legacy products created with a fixed sale price while cost was never set
 * (`precioCompra = 0`, `precioVenta > 0`) were silently treated as `MARGEN`
 * by the column default. Treat them as `FIJO` so restock keeps their price.
 *
 * The `tipoPrecio='MARGEN'` guard makes this idempotent: once a row flips to
 * `FIJO` it no longer matches, so re-running is a no-op.
 */
export const TIPO_PRECIO_BACKFILL_SQL =
  "UPDATE productos SET tipoPrecio='FIJO' WHERE tipoPrecio='MARGEN' AND precioCompra=0 AND precioVenta>0";

/** Minimal contract needed from a TypeORM DataSource — keeps the unit test fake-able. */
export interface BackfillDataSource {
  query: (query: string) => Promise<unknown>;
}

/**
 * Flips zero-cost fixed-price products to `FIJO`. Returns the number of rows
 * changed (0 when nothing matched). Never throws here — callers own failure.
 */
export async function backfillTipoPrecio(
  ds: BackfillDataSource = AppDataSource,
): Promise<number> {
  const result = await ds.query(TIPO_PRECIO_BACKFILL_SQL);
  return (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

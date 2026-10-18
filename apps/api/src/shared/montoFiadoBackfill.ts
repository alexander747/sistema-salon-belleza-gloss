/**
 * One-off, idempotent backfill for the legacy `registros_servicio.montoFiado`
 * snapshot.
 *
 * New sales persist `montoFiado` at creation (the unpaid amount at sale time).
 * Rows created before the additive column existed are NULL, so consumers fall
 * back to the CURRENT `montoPendiente` and lose the historical fiado as soon as
 * the debt is collected.
 *
 * Heuristic
 * ---------
 * `montoFiado = max(0, valorFinal − Σ payments made AT the sale)`, where a
 * payment counts as "at the sale" when
 * `p.creadoEn <= r.creadoEn + MONTO_FIADO_PAYMENT_WINDOW_SECONDS`.
 *
 * The sale's own payments are inserted in the SAME transaction as the registro,
 * so their `creadoEn` is a few milliseconds later. Later debt collections carry
 * a later `creadoEn` and are excluded, which is what preserves the historical
 * fiado. ANULADO registros are set to 0.
 *
 * Known limitation
 * ----------------
 * A payment recorded much later is classified as a collection, never as part of
 * the sale. Conversely, a debt collection registered within the small window
 * (60s) right after the sale would be misclassified as paid-at-sale and shrink
 * the reconstructed fiado. The window is a deliberate, documented trade-off.
 *
 * The backfill only ever touches rows where `montoFiado IS NULL`, so running it
 * again is a no-op and a crash mid-run resumes on the next boot.
 */

export const MONTO_FIADO_PAYMENT_WINDOW_SECONDS = 60;

/** Minimal contract needed from a TypeORM DataSource — keeps the test fake-able. */
export interface MontoFiadoBackfillDataSource {
  query: (query: string, parameters?: unknown[]) => Promise<unknown>;
}

/** A legacy registro plus the payments that were already made at sale time. */
export interface MontoFiadoBackfillRow {
  id: number;
  estado: string;
  valorFinal: number | string | null;
  pagadoEnVenta: number | string | null;
}

export interface MontoFiadoBackfillSummary {
  /** Legacy rows read (`montoFiado IS NULL`). */
  scanned: number;
  /** Rows whose snapshot was written by this run. */
  filled: number;
  /** Rows that are ANULADO (snapshot forced to 0). */
  anulados: number;
  /** Rows reconstructed with a positive fiado. */
  withDebt: number;
}

/**
 * Pure reconstruction of one registro's `montoFiado`.
 * `pagadoEnVenta` is the Σ of payments inside the at-sale window; the caller
 * owns the temporal classification (see the module comment).
 */
export function computeMontoFiado(row: {
  estado: string;
  valorFinal: number | string | null;
  pagadoEnVenta: number | string | null;
}): number {
  if (row.estado === 'ANULADO') return 0;

  const valorFinal = Number(row.valorFinal ?? 0);
  const pagadoEnVenta = Number(row.pagadoEnVenta ?? 0);
  if (!Number.isFinite(valorFinal) || !Number.isFinite(pagadoEnVenta)) return 0;

  const fiado = valorFinal - pagadoEnVenta;
  // DECIMAL(12,2) operands: round away binary floating-point noise.
  return Math.max(0, Number(fiado.toFixed(2)));
}

/**
 * Reads only legacy rows (idempotency guard) and aggregates the payments that
 * fall inside the at-sale window. The window is a code constant, so it is
 * interpolated as a literal instead of a bound parameter.
 */
export const MONTO_FIADO_BACKFILL_SELECT_SQL = `
SELECT
  r.id AS id,
  r.estado AS estado,
  r.valorFinal AS valorFinal,
  COALESCE(SUM(CASE
    WHEN p.creadoEn <= DATE_ADD(r.creadoEn, INTERVAL ${MONTO_FIADO_PAYMENT_WINDOW_SECONDS} SECOND)
    THEN p.monto ELSE 0
  END), 0) AS pagadoEnVenta
FROM registros_servicio r
LEFT JOIN pagos_transaccion p ON p.registroServicioId = r.id
WHERE r.montoFiado IS NULL
GROUP BY r.id, r.estado, r.valorFinal
`.trim();

/** The `montoFiado IS NULL` guard keeps concurrent/repeated runs harmless. */
export const MONTO_FIADO_BACKFILL_UPDATE_SQL =
  'UPDATE registros_servicio SET montoFiado = ? WHERE id = ? AND montoFiado IS NULL';

function normalizeRows(result: unknown): MontoFiadoBackfillRow[] {
  return Array.isArray(result) ? (result as MontoFiadoBackfillRow[]) : [];
}

/**
 * Reconstructs `montoFiado` for every legacy row. Returns a summary the caller
 * logs. Throws on datasource errors — callers own failure handling (the startup
 * hook treats it as non-fatal).
 */
export async function backfillMontoFiado(
  ds: MontoFiadoBackfillDataSource,
): Promise<MontoFiadoBackfillSummary> {
  const rows = normalizeRows(await ds.query(MONTO_FIADO_BACKFILL_SELECT_SQL));

  const summary: MontoFiadoBackfillSummary = {
    scanned: rows.length,
    filled: 0,
    anulados: 0,
    withDebt: 0,
  };

  for (const row of rows) {
    const monto = computeMontoFiado(row);
    if (row.estado === 'ANULADO') summary.anulados += 1;
    if (monto > 0) summary.withDebt += 1;

    const result = await ds.query(MONTO_FIADO_BACKFILL_UPDATE_SQL, [monto, row.id]);
    const affected = (result as { affectedRows?: number } | undefined)?.affectedRows;
    // Drivers may omit affectedRows; in that case the successful statement is
    // the only observable evidence, so count the row as filled.
    summary.filled += affected ?? 1;
  }

  return summary;
}

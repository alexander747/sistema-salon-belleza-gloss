import { injectable } from 'tsyringe';

/** Cost mode of a service line. `FIJO` uses `costoBaseInsumos`; `POR_GRAMO` uses `gramosUsados × precioPorGramo`. */
export type TipoCostoInsumo = 'FIJO' | 'POR_GRAMO';

export interface CostoLineaInput {
  tipoCostoInsumo?: TipoCostoInsumo | null;
  /** Catalog price per gram (only used by `POR_GRAMO`). */
  precioPorGramo?: number | null;
  /** Grams used for the line (per unit). */
  gramosUsados?: number | null;
  /** Fixed catalog cost (only used by `FIJO`). */
  costoBaseInsumos?: number | null;
}

/** Defensive 2-decimal rounding to avoid floating point noise. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Single server-authoritative cost point for a registro line. The caller
 * resolves the catalog service first; this service only does pure math:
 *
 * - `POR_GRAMO` → `round2(gramosUsados × precioPorGramo)` (client cost ignored).
 * - `FIJO` or missing → `costoBaseInsumos` (catalog value; 0 when absent).
 */
@injectable()
export class CostoInsumoService {
  calcularCostoLinea(linea: CostoLineaInput): number {
    if (linea.tipoCostoInsumo === 'POR_GRAMO') {
      const gramos = Number(linea.gramosUsados ?? 0);
      const precio = Number(linea.precioPorGramo ?? 0);
      return round2(gramos * precio);
    }
    return Number(linea.costoBaseInsumos ?? 0);
  }
}

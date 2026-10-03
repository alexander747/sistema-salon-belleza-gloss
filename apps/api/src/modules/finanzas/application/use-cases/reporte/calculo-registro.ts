/**
 * Cálculo compartido de contribuciones por registro ajustadas por descuento.
 *
 * Modelo vigente (E2/E3): la DB guarda `totalServicios`/`totalProductos` como
 * valores BRUTOS (pre-descuento), `porcentajeDescuento` y `descuentoAlcance`
 * (SERVICIOS | PRODUCTOS | AMBOS). Cada lado se deriva aplicando el % SOLO al
 * alcance elegido:
 *   servNeto  = round(totalServicios × (1 − pctServ/100))
 *   prodNeto  = round(totalProductos × (1 − pctProd/100))
 * donde pctServ se anula si el alcance es PRODUCTOS y pctProd si es SERVICIOS.
 *
 * Compatibilidad: los registros creados ANTES de `descuentoAlcance`
 * (`descuentoAlcance == null`) o con un ajuste de "valor total" heredado se
 * resuelven con el prorrateo proporcional sobre `valorFinal` (comportamiento
 * previo), para no reescribir la historia contable.
 */

export type DescuentoAlcance = 'SERVICIOS' | 'PRODUCTOS' | 'AMBOS';

export interface ContribucionesRegistro {
  /** Contribución post-descuento de servicios (redondeada). */
  servicios: number;
  /** Contribución post-descuento de productos (redondeada). */
  productos: number;
}

export function calcularContribucionesRegistro(params: {
  totalServicios: number;
  totalProductos: number;
  propina: number;
  montoTotal: number;
  /** Total realmente cobrado; si no se provee se asume sin descuento. */
  valorFinal?: number;
  /** % de descuento aplicado (0–100). */
  porcentajeDescuento?: number;
  /** Alcance del descuento; `null`/ausente → prorrateo legacy sobre `valorFinal`. */
  descuentoAlcance?: DescuentoAlcance | null;
}): ContribucionesRegistro {
  const { totalServicios, totalProductos, propina, montoTotal, descuentoAlcance } = params;
  const valorFinal = params.valorFinal ?? montoTotal;

  // ── Modelo por alcance (registros nuevos) ──
  if (descuentoAlcance != null) {
    const pct = params.porcentajeDescuento ?? 0;
    const pctServ = descuentoAlcance === 'SERVICIOS' || descuentoAlcance === 'AMBOS' ? pct : 0;
    const pctProd = descuentoAlcance === 'PRODUCTOS' || descuentoAlcance === 'AMBOS' ? pct : 0;
    const servNeto = Math.round(totalServicios * (1 - pctServ / 100));
    const prodNeto = Math.round(totalProductos * (1 - pctProd / 100));

    // Reconciliación: `valorFinal` es la fuente de verdad de lo cobrado. Si el
    // resultado por alcance coincide con lo cobrado (registro nuevo), se usa.
    // Si no (registro legacy con ajuste de "valor total" y columna heredada por
    // el default), se cae al prorrateo proporcional para no alterar la historia.
    const esperado = servNeto + prodNeto;
    const real = Math.max(0, valorFinal - propina);
    if (Math.abs(esperado - real) <= 1) {
      return { servicios: servNeto, productos: prodNeto };
    }
  }

  // ── Prorrateo proporcional legacy ──
  // Proporción del descuento sobre (servicios + productos), excluyendo propina.
  const baseBruta = montoTotal - propina; // serv + prod brutos
  const baseReal = valorFinal - propina; // serv + prod reales (post-descuento)
  const proporcion = baseBruta > 0 ? baseReal / baseBruta : 1;

  return {
    servicios: Math.round(totalServicios * proporcion),
    productos: Math.round(totalProductos * proporcion),
  };
}

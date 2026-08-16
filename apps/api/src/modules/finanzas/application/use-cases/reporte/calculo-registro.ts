/**
 * Cálculo compartido de contribuciones por registro ajustadas por descuento.
 *
 * La DB guarda `totalServicios`/`totalProductos` como valores brutos
 * (pre-descuento) y `valorFinal` como el total realmente cobrado. La proporción
 * del descuento se aplica a servicios y productos por separado para mantener la
 * consistencia (misma lógica que ResumenDiaUseCase, extraída como fuente única
 * de verdad para los reportes: resumen diario y P&L mensual).
 */

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
}): ContribucionesRegistro {
  const { totalServicios, totalProductos, propina, montoTotal } = params;
  const valorFinal = params.valorFinal ?? montoTotal;

  // Proporción del descuento sobre (servicios + productos), excluyendo propina
  const baseBruta = montoTotal - propina; // serv + prod brutos
  const baseReal = valorFinal - propina; // serv + prod reales (post-descuento)
  const proporcion = baseBruta > 0 ? baseReal / baseBruta : 1;

  return {
    servicios: Math.round(totalServicios * proporcion),
    productos: Math.round(totalProductos * proporcion),
  };
}

/**
 * Monto que queda pendiente de cobrar en una venta con pago parcial o fiado.
 *
 * La propina queda FUERA de la deuda (decisión owner D8): se asume pagada al
 * momento, nunca se fía. El backend calcula `montoPendiente = max(0, valorFinal
 * − propina − Σ pagos)` — esta función replica esa fórmula para el display.
 */
export function calcularPendiente(finalTotal: number, propina: number, montoPagado: number): number {
  return Math.max(0, finalTotal - propina - montoPagado);
}

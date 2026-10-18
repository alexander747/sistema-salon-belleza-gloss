/**
 * Saldo inicial de caja (capital de apertura del negocio).
 *
 * `saldoInicialCaja` es la plata que el negocio ya tenía ANTES de usar el
 * sistema: es el punto de partida de la caja, NO una ganancia, y NUNCA alimenta
 * el P&L. `posicionCaja` = saldo inicial + efecto de caja acumulado de las cajas
 * cerradas (informativo).
 */
export interface SaldoInicialCajaDTO {
  saldoInicialCaja: number;
  posicionCaja: number;
}

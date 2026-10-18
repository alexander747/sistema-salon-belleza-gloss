export interface CajaCerradaPosicionInput {
  montoInicial: number | string | null | undefined;
  montoEsperado: number | string | null | undefined;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * "Posición de caja" (INFORMATIVA, nunca ingreso): capital de apertura +
 * efecto NETO de efectivo acumulado por cada caja CERRADA.
 *
 * Por cierre, `montoEsperado − montoInicial = Σ efectivo recaudado − Σ gastos en
 * efectivo − Σ egresos (devoluciones/nómina) en efectivo` (ver
 * `calcularReporteCierre`). Sumar ese delta neto entre cajas cerradas da el
 * movimiento de caja acumulado desde que se usa el sistema; sumarle
 * `saldoInicialCaja` (la plata que el negocio ya tenía ANTES del sistema) da el
 * efectivo real disponible.
 *
 * Decisión documentada (la spec permite un fallback acá): se usa
 * `montoEsperado` —el arqueo persistido, que YA descuenta las salidas de caja
 * del día— en lugar del desglose de solo-ingresos
 * (`montoEfectivo`/`montoRecaudado`), porque únicamente los deltas netos
 * reconstruyen el efectivo real. Las cajas ABIERTAS se excluyen: su arqueo
 * todavía no está persistido (`reabrir` limpia los campos del cierre, así que
 * tampoco hay doble conteo).
 */
export function calcularPosicionCaja(
  saldoInicialCaja: number | string | null | undefined,
  cajasCerradas: CajaCerradaPosicionInput[],
): number {
  const saldo = Number(saldoInicialCaja ?? 0);
  const saldoSeguro = Number.isFinite(saldo) ? saldo : 0;

  const efecto = cajasCerradas.reduce((sum, c) => {
    const esperado = Number(c.montoEsperado ?? 0);
    const inicial = Number(c.montoInicial ?? 0);
    const esperadoSeguro = Number.isFinite(esperado) ? esperado : 0;
    const inicialSeguro = Number.isFinite(inicial) ? inicial : 0;
    return sum + (esperadoSeguro - inicialSeguro);
  }, 0);

  return round2(saldoSeguro + efecto);
}

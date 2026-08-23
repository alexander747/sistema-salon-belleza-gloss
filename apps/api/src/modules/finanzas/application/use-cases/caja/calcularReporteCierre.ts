import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

export type MetodoPagoCaja = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

export interface PorMetodoPagoTotals {
  EFECTIVO: number;
  TARJETA: number;
  TRANSFERENCIA: number;
}

/**
 * Tipo estructural de movimiento de caja (compatible con RegistroServicioEntity):
 * la función pura no acopla al repositorio y es trivialmente testeable.
 * Las líneas informativas (ingresosBrutos/netos, comisiones) se derivan de los
 * registros; el dinero del arqueo (porMetodoPago/montoEsperado) se deriva de
 * `pagosExtra` (los pagos que pertenecen a ESTA caja según `pago.cajaId`).
 */
export interface MovimientoCajaInput {
  estado: EstadoRegistro;
  totalServicios: number;
  totalProductos: number;
  comisionCalculada: number;
  precioAjustado: boolean;
  valorOriginal: number;
  valorFinal: number;
}

/** Pago que pertenece a la caja (pago.cajaId = C o fallback legacy por registro.cajaId). */
export interface PagoExtraCajaInput {
  monto: number;
  metodoPago: MetodoPagoCaja;
}

/** Tipo estructural de gasto (compatible con GastoEntity). */
export interface GastoCajaInput {
  monto: number;
  metodoPago?: MetodoPagoCaja;
}

export interface ReporteCierre {
  totalServicios: number;
  totalProductos: number;
  ingresosBrutos: number;
  descuentos: number;
  ingresosNetos: number;
  porMetodoPago: PorMetodoPagoTotals;
  comisiones: number;
  totalGastos: number;
  montoEsperado: number;
  montoReal: number | null;
  diferencia: number | null;
  cantidadMovimientos: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Función pura del reporte de cierre (arqueo).
 *
 * Decisión owner: el arqueo es CASH-ONLY — el cajero cuenta el cajón COMPLETO
 * al cerrar, que incluye el fondo inicial. Por lo tanto:
 *   `montoEsperado = montoInicial + Σ pagos EFECTIVO − Σ gastos EFECTIVO`
 * El breakdown por método de pago se reporta completo como información.
 * Los registros ANULADOS se excluyen de todos los totales.
 *
 * Contabilidad de CAJA con abonos (ventas-fiado-deudas): el dinero se cuenta en
 * la caja donde se RECIBIÓ, identificada por `pago.cajaId`. Cada caja pasa su
 * conjunto completo de pagos vía `pagosExtra` (repo `findByCajaConFallback`):
 *   pagosCaja = {p.cajaId = C} ∪ {p.cajaId NULL ∧ r.cajaId = C} → porMetodoPago
 * Así un abono de HOY sobre un registro de AYER entra en el arqueo de HOY y
 * cada pago cuenta en UNA sola caja — sin doble conteo.
 *
 * `montoRealEfectivo` es null en preview (GET /caja/actual/esperado) → `diferencia` null.
 */
export function calcularReporteCierre(
  registros: MovimientoCajaInput[],
  gastos: GastoCajaInput[],
  montoRealEfectivo: number | null,
  montoInicial: number = 0,
  pagosExtra: PagoExtraCajaInput[] = [],
): ReporteCierre {
  const activos = registros.filter((r) => r.estado !== EstadoRegistro.ANULADO);

  const totalServicios = activos.reduce((sum, r) => sum + Number(r.totalServicios), 0);
  const totalProductos = activos.reduce((sum, r) => sum + Number(r.totalProductos), 0);
  const descuentos = activos.reduce(
    (sum, r) => sum + (r.precioAjustado ? Number(r.valorOriginal) - Number(r.valorFinal) : 0),
    0,
  );
  const comisiones = activos.reduce((sum, r) => sum + Number(r.comisionCalculada), 0);

  // Dinero de la caja: SOLO los pagos que pertenecen a esta caja (pagosExtra).
  // No se suman r.pagos: un pago de un abono posterior (pago.cajaId = otra caja)
  // vive en el registro pero debe contar en la caja donde se recibió.
  const porMetodoPago: PorMetodoPagoTotals = {
    EFECTIVO: 0,
    TARJETA: 0,
    TRANSFERENCIA: 0,
  };
  for (const p of pagosExtra) {
    porMetodoPago[p.metodoPago] = (porMetodoPago[p.metodoPago] ?? 0) + Number(p.monto);
  }

  const ingresosBrutos = totalServicios + totalProductos;
  const ingresosNetos = ingresosBrutos - descuentos;

  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto), 0);
  const gastosEfectivo = gastos
    .filter((g) => (g.metodoPago ?? 'EFECTIVO') === 'EFECTIVO')
    .reduce((sum, g) => sum + Number(g.monto), 0);

  // Arqueo cash-only: el cajero cuenta el cajón completo (fondo inicial + movimientos)
  const montoEsperado = round2(montoInicial + porMetodoPago.EFECTIVO - gastosEfectivo);
  const diferencia = montoRealEfectivo === null ? null : round2(montoRealEfectivo - montoEsperado);

  return {
    totalServicios: round2(totalServicios),
    totalProductos: round2(totalProductos),
    ingresosBrutos: round2(ingresosBrutos),
    descuentos: round2(descuentos),
    ingresosNetos: round2(ingresosNetos),
    porMetodoPago: {
      EFECTIVO: round2(porMetodoPago.EFECTIVO),
      TARJETA: round2(porMetodoPago.TARJETA),
      TRANSFERENCIA: round2(porMetodoPago.TRANSFERENCIA),
    },
    comisiones: round2(comisiones),
    totalGastos: round2(totalGastos),
    montoEsperado,
    montoReal: montoRealEfectivo,
    diferencia,
    cantidadMovimientos: activos.length + gastos.length,
  };
}

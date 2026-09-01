import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import {
  colombiaDayStartUTC,
  colombiaDayEndUTC,
  getColombiaDateString,
} from '../../../../../shared/colombia-date';

export interface ResumenMensualInput {
  salonId: number;
  /** Cantidad de meses a incluir (incluye el actual). Default: 6. */
  meses?: number;
}

export interface ResumenMensualItem {
  /** 'YYYY-MM' en Colombia (UTC-5). */
  mes: string;
  ingresos: number;
  gastos: number;
  nomina: number;
  ganancia: number;
}

/** Redondeo defensivo a 2 decimales para evitar ruido de punto flotante. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mes 'YYYY-MM' de una columna DATE (sin hora). La fecha pura ya ES Colombia:
 *  no hay desfase de zona, se usan las partes UTC del valor tal cual. */
function mesDeFechaColombia(fecha: Date | string): string {
  const d = fecha instanceof Date ? fecha : new Date(`${fecha}T00:00:00Z`);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Mes 'YYYY-MM' en Colombia de un timestamp (instante UTC real): se convierte
 *  a la fecha de negocio Colombia antes de extraer el mes. */
function mesDeTimestamp(ts: Date): string {
  return getColombiaDateString(new Date(ts)).slice(0, 7);
}

/**
 * Resumen mensual (cash basis): Σ pagos cobrados, gastos y nómina agrupados por
 * mes, para los últimos N meses incluyendo el actual (default 6). Siempre
 * devuelve la serie completa — los meses sin datos aparecen con 0.
 */
@injectable()
export class ResumenMensualUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
  ) {}

  async execute(input: ResumenMensualInput): Promise<ResumenMensualItem[]> {
    const meses = Math.min(Math.max(input.meses ?? 6, 1), 24);

    // Mes actual en Colombia (UTC-5): antes de medianoche Colombia el día UTC
    // se adelanta — restar 5h mantiene el mes de negocio correcto.
    const mesActual = getColombiaDateString().slice(0, 7);
    const [anioActual, mesActualNum] = mesActual.split('-').map(Number);

    // Rango de meses 'YYYY-MM' ascendente: [actual − (meses − 1) … actual].
    // Date.UTC maneja el salto de año (meses negativos).
    const mesesList: string[] = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(anioActual, mesActualNum - 1 - i, 1));
      mesesList.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    // Límites Colombia del rango completo (borde 05:00 UTC del día siguiente).
    const desde = colombiaDayStartUTC(`${mesesList[0]}-01`);
    const [anioUlt, mesUlt] = mesesList[mesesList.length - 1].split('-').map(Number);
    const ultimoDia = new Date(Date.UTC(anioUlt, mesUlt, 0)); // día 0 del mes siguiente = último día
    const ultimoDiaStr =
      `${ultimoDia.getUTCFullYear()}-` +
      `${String(ultimoDia.getUTCMonth() + 1).padStart(2, '0')}-` +
      `${String(ultimoDia.getUTCDate()).padStart(2, '0')}`;
    const hasta = colombiaDayEndUTC(ultimoDiaStr);

    const mesesSet = new Set(mesesList);

    const [pagosPorMes, todosGastos, todasLiquidaciones] = await Promise.all([
      this.registroRepo.sumPagosPorMes(input.salonId, desde, hasta),
      this.gastoRepo.findBySalon(input.salonId),
      this.liquidacionRepo.findBySalon(input.salonId),
    ]);

    // ── Gastos: Σ monto por mes (fecha Colombia del gasto) ──
    const gastosPorMes = new Map<string, number>();
    for (const g of todosGastos) {
      const mes = mesDeFechaColombia(g.fecha);
      if (!mesesSet.has(mes)) continue;
      gastosPorMes.set(mes, (gastosPorMes.get(mes) ?? 0) + Number(g.monto));
    }

    // ── Nómina: Σ totalPagado por mes (fecha Colombia de la liquidación) ──
    const nominaPorMes = new Map<string, number>();
    for (const l of todasLiquidaciones) {
      const mes = mesDeTimestamp(l.creadoEn);
      if (!mesesSet.has(mes)) continue;
      nominaPorMes.set(mes, (nominaPorMes.get(mes) ?? 0) + Number(l.totalPagado));
    }

    // ── Ingresos: Σ pagos cobrados por mes (cash, fecha de la caja del pago) ──
    const ingresosPorMes = new Map(pagosPorMes.map((p) => [p.mes, p.total]));

    return mesesList.map((mes) => {
      const ingresos = ingresosPorMes.get(mes) ?? 0;
      const gastos = gastosPorMes.get(mes) ?? 0;
      const nomina = nominaPorMes.get(mes) ?? 0;
      return {
        mes,
        ingresos: round2(ingresos),
        gastos: round2(gastos),
        nomina: round2(nomina),
        ganancia: round2(ingresos - gastos - nomina),
      };
    });
  }
}

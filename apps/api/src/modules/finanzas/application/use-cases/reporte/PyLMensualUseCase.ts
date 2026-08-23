import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import {
  colombiaDayStartUTC,
  colombiaDayEndUTC,
  getColombiaDateString,
} from '../../../../../shared/colombia-date';
import { calcularContribucionesRegistro } from './calculo-registro';

export interface PyLMensualInput {
  salonId: number;
  desde?: string; // YYYY-MM-DD (fecha Colombia) — inicio del período
  hasta?: string; // YYYY-MM-DD (fecha Colombia) — fin del período
  usuarioId?: number; // filtro por empleada (opcional; los gastos/dev. no se filtran)
}

export interface PyLMensualOutput {
  desde: string;
  hasta: string;
  cantidadAtenciones: number;
  ingresosBrutos: number;
  descuentos: number;
  ingresosNetos: number;
  totalServicios: number;
  totalProductos: number;
  propinas: number;
  /** Σ pagos recibidos en el período por fecha de recepción (cash basis). */
  cobrado: number;
  /** Σ montoPendiente de registros del período (fiado originado). */
  fiadoPeriodo: number;
  /** Σ montoPendiente de registros no ANULADO con fecha ≤ hasta (snapshot). */
  deudasPorCobrar: number;
  costoBaseInsumos: number;
  margenBruto: number;
  comisiones: number;
  gastosFijos: number;
  gastosOperativos: number;
  gastosPorCategoria: Record<string, number>;
  totalGastos: number;
  devoluciones: number;
  /** Utilidad en base CAJA: cobrado − insumos − comisiones − gastos − devoluciones. */
  utilidadNeta: number;
}

/** Redondeo defensivo a 2 decimales para evitar ruido de punto flotante. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@injectable()
export class PyLMensualUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
    @inject('IDevolucionRepository')
    private readonly devolucionRepo: IDevolucionRepository,
  ) {}

  async execute(input: PyLMensualInput): Promise<PyLMensualOutput> {
    const hoy = getColombiaDateString();
    // Período por defecto: mes actual en Colombia (día 1 → hoy).
    const desde = input.desde ?? `${hoy.slice(0, 7)}-01`;
    const hasta = input.hasta ?? hoy;

    // Registros y devoluciones usan creadoEn (timestamp): límites Colombia 05:00 UTC.
    const inicio = colombiaDayStartUTC(desde);
    const fin = colombiaDayEndUTC(hasta);

    // Gastos usan la columna fecha (DATE sin hora): límites a medianoche UTC para
    // que el rango sea inclusivo en ambos extremos con la comparación cerrada
    // (>= / <=) que aplica gastoRepo.search.
    const gastoDesde = new Date(`${desde}T00:00:00.000Z`);
    const gastoHasta = new Date(`${hasta}T00:00:00.000Z`);

    const [registros, gastos, devoluciones, cobrado, fiadoPeriodo, deudasPorCobrar] = await Promise.all([
      this.registroRepo.search({
        salonId: input.salonId,
        desde: inicio,
        hasta: fin,
        ...(input.usuarioId !== undefined ? { usuarioId: input.usuarioId } : {}),
      }),
      this.gastoRepo.search({
        salonId: input.salonId,
        desde: gastoDesde,
        hasta: gastoHasta,
      }),
      this.devolucionRepo.sumBySalonAndDateRange(input.salonId, inicio, fin),
      // Cash basis: cobrado por fecha de recepción (pago.creadoEn); el filtro de
      // empleada aplica igual que a los registros devengados.
      this.registroRepo.sumPagosPorPeriodo(
        input.salonId,
        inicio,
        fin,
        input.usuarioId,
      ),
      // Fiado originado en el período (fecha de negocio del registro).
      this.registroRepo.sumMontoPendientePorPeriodo(input.salonId, inicio, fin),
      // Deudas por cobrar acumuladas a la fecha de negocio ≤ fin del período.
      this.registroRepo.sumMontoPendienteHasta(input.salonId, fin),
    ]);

    let ingresosBrutos = 0;
    let ingresosNetos = 0;
    let totalServicios = 0;
    let totalProductos = 0;
    let propinas = 0;
    let comisiones = 0;
    let costoBaseInsumos = 0;
    let cantidadAtenciones = 0;

    for (const r of registros) {
      // Los registros ANULADO no aportan al P&L
      if (r.estado === 'ANULADO') continue;

      const servBruto = Number(r.totalServicios);
      const prodBruto = Number(r.totalProductos);
      const propina = Number(r.propina);
      const montoTotal = Number(r.montoTotal);

      const { servicios: servContrib, productos: prodContrib } =
        calcularContribucionesRegistro({
          totalServicios: servBruto,
          totalProductos: prodBruto,
          propina,
          montoTotal,
          valorFinal: r.valorFinal != null ? Number(r.valorFinal) : montoTotal,
        });

      ingresosBrutos += servBruto + prodBruto;
      ingresosNetos += servContrib + prodContrib;
      totalServicios += servContrib;
      totalProductos += prodContrib;
      propinas += propina;
      comisiones += Number(r.comisionCalculada);

      const costoBaseItems = (r.serviciosItems ?? []).reduce(
        (sum, si) => sum + Number(si.costoBaseInsumos ?? 0),
        0,
      );
      costoBaseInsumos += Math.round(costoBaseItems);

      if (servBruto > 0) cantidadAtenciones += 1;
    }

    // ── Gastos: split fijo/operativo + agrupación por categoría ──
    let gastosFijos = 0;
    let gastosOperativos = 0;
    const gastosPorCategoria: Record<string, number> = {};
    for (const g of gastos) {
      const monto = Number(g.monto);
      if (g.esGastoFijo) gastosFijos += monto;
      else gastosOperativos += monto;
      const categoria = g.categoria || 'OTROS';
      gastosPorCategoria[categoria] = (gastosPorCategoria[categoria] ?? 0) + monto;
    }
    const totalGastos = gastosFijos + gastosOperativos;

    const costoBaseInsumosRounded = round2(costoBaseInsumos);
    const margenBruto = round2(ingresosNetos - costoBaseInsumosRounded);
    // Contabilidad de CAJA (decisión owner): el ingreso se cuenta cuando se cobra.
    // Las líneas devengadas (ingresosBrutos/ingresosNetos/…) quedan informativas.
    const utilidadNeta = round2(
      cobrado - costoBaseInsumosRounded - comisiones - totalGastos - devoluciones,
    );

    return {
      desde,
      hasta,
      cantidadAtenciones,
      ingresosBrutos: round2(ingresosBrutos),
      descuentos: round2(ingresosBrutos - ingresosNetos),
      ingresosNetos: round2(ingresosNetos),
      totalServicios: round2(totalServicios),
      totalProductos: round2(totalProductos),
      propinas: round2(propinas),
      cobrado: round2(cobrado),
      fiadoPeriodo: round2(fiadoPeriodo),
      deudasPorCobrar: round2(deudasPorCobrar),
      costoBaseInsumos: costoBaseInsumosRounded,
      margenBruto,
      comisiones: round2(comisiones),
      gastosFijos: round2(gastosFijos),
      gastosOperativos: round2(gastosOperativos),
      gastosPorCategoria,
      totalGastos: round2(totalGastos),
      devoluciones: round2(devoluciones),
      utilidadNeta,
    };
  }
}

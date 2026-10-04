import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IPagoPrestamoRepository } from '../../../../prestamos/domain/ports/IPagoPrestamoRepository';
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
  /**
   * Filtro por empleada (opcional). Cuando está activo, el resultado es la
   * CONTRIBUCIÓN de la empleada (cobrado − insumos − comisión) y los gastos y
   * devoluciones del salón NO se le descuentan: se exponen aparte en
   * `gastosNegocio`/`devolucionesNegocio`.
   */
  usuarioId?: number;
  clienteId?: number; // filtro por cliente (opcional)
}

export interface PyLMensualOutput {
  desde: string;
  hasta: string;
  cantidadAtenciones: number;
  ingresosBrutos: number;
  descuentos: number;
  /** Ajustes de valor hacia ARRIBA (cobrar más que el precio del servicio). */
  incrementos: number;
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
  /** Σ totalPagado de nómina EFECTIVO del período (Rule C, cash-basis). */
  nomina: number;
  /**
   * Σ cobros MANUAL de préstamos del período (Rule C, cash-basis). Es un
   * INGRESO: "Préstamos" son cuentas por cobrar que el deudor devuelve. Incluye
   * todos los métodos (una transferencia no toca el cajón pero sí es ingreso).
   */
  pagosPrestamo: number;
  /** Contribución del resultado: cobrado − insumos − comisiones (sin gastos del negocio). */
  contribucion: number;
  /** Gastos del NEGOCIO (salón). Se exponen aparte y NO se descuentan a una empleada filtrada. */
  gastosNegocio: number;
  /** Devoluciones del NEGOCIO (salón). Se exponen aparte y NO se descuentan a una empleada filtrada. */
  devolucionesNegocio: number;
  /**
   * Utilidad en base CAJA.
   * Sin filtro de empleada: `contribucion − gastosNegocio − devolucionesNegocio
   * − nómina + pagosPrestamo`.
   * Con filtro de empleada: solo `contribucion` (los gastos/devoluciones del
   * salón no se le cargan; se exponen aparte como "del salón").
   */
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
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
    @inject('IPagoPrestamoRepository')
    private readonly pagoPrestamoRepo: IPagoPrestamoRepository,
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

    const [
      registros,
      gastos,
      devoluciones,
      nomina,
      pagosPrestamo,
      cobrado,
      fiadoPeriodo,
      deudasPorCobrar,
    ] = await Promise.all([
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
      // Rule C: la nómina en EFECTIVO es un egreso cash-basis del período.
      this.liquidacionRepo.sumEfectivoBySalonAndDateRange(input.salonId, inicio, fin),
      // Rule C (corregido): los cobros MANUAL de préstamos son un INGRESO
      // cash-basis (cuentas por cobrar que el deudor devuelve).
      this.pagoPrestamoRepo.sumManualBySalonAndDateRange(input.salonId, inicio, fin),
      // Cash basis: cobrado por fecha de recepción (pago.creadoEn); el filtro de
      // empleada/cliente aplica igual que a los registros devengados.
      this.registroRepo.sumPagosPorPeriodo(
        input.salonId,
        inicio,
        fin,
        input.usuarioId,
        input.clienteId,
      ),
      // Fiado originado en el período (fecha de negocio del registro).
      this.registroRepo.sumMontoPendientePorPeriodo(input.salonId, inicio, fin, input.usuarioId, input.clienteId),
      // Deudas por cobrar acumuladas a la fecha de negocio ≤ fin del período.
      this.registroRepo.sumMontoPendienteHasta(input.salonId, fin, input.usuarioId, input.clienteId),
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
          porcentajeDescuento: Number(r.porcentajeDescuento ?? 0),
          descuentoAlcance: r.descuentoAlcance ?? null,
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
    //
    // Contribución = cobrado − insumos − comisiones: el resultado "propio" del
    // scope (empleada o salón) antes de los gastos/devoluciones del negocio.
    const contribucion = round2(cobrado - costoBaseInsumosRounded - comisiones);
    const gastosNegocio = round2(totalGastos);
    const devolucionesNegocio = round2(devoluciones);

    // Rule C (corregido): los cobros de préstamo son INGRESOS (+), no egresos.
    // NO hay doble conteo del capital: el desembolso entra UNA sola vez como
    // gasto (CrearPrestamoUseCase, categoría 'Prestamo') y cada cobro entra UNA
    // sola vez aquí; el principal desembolsado y el recuperado se cancelan a lo
    // largo de la vida del préstamo.
    //
    // Follow-up (deuda técnica, NO inventar modelo de interés): el préstamo NO
    // registra interés. PrestamoEntity y PagoPrestamoEntity solo guardan montos
    // de capital, sin campo de interés. Contablemente solo el INTERÉS sería
    // ingreso operativo y el capital una recuperación de cuenta por cobrar; al
    // no modelarse, aquí no hay ingreso real. Si el negocio empieza a cobrar
    // interés: agregar el campo y exponer capital/interés por separado.
    //
    // Filtro por empleada (decisión owner): los gastos y devoluciones son del
    // NEGOCIO, no de la empleada. Con filtro activo NO se le descuentan: su
    // resultado es su contribución, y el negocio se expone aparte. Sin filtro se
    // mantiene el resultado salon-wide (gastos, devoluciones y nómina incluidos).
    const esFiltroEmpleada = input.usuarioId !== undefined;
    const utilidadNeta = esFiltroEmpleada
      ? contribucion
      : round2(contribucion - gastosNegocio - devolucionesNegocio - nomina + pagosPrestamo);

    // Semántica: el ajuste de valor puede ser hacia ABAJO (descuento real) o
    // hacia ARRIBA (incremento — p.ej. cobrar 50.000 un servicio de 40.000).
    // Un incremento NUNCA debe reportarse como descuento (bug reportado por el
    // dueño): descuentos queda ≥ 0 e incrementos captura la diferencia opuesta.
    const diferencia = ingresosBrutos - ingresosNetos;
    const descuentos = Math.max(0, diferencia);
    const incrementos = Math.max(0, -diferencia);

    return {
      desde,
      hasta,
      cantidadAtenciones,
      ingresosBrutos: round2(ingresosBrutos),
      descuentos: round2(descuentos),
      incrementos: round2(incrementos),
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
      nomina: round2(nomina),
      pagosPrestamo: round2(pagosPrestamo),
      contribucion,
      gastosNegocio,
      devolucionesNegocio,
      utilidadNeta,
    };
  }
}

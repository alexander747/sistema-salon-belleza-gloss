import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { calcularContribucionesRegistro } from './calculo-registro';

export interface ResumenDiaInput {
  salonId: number;
  fecha?: string; // YYYY-MM-DD (Colombia date) — single day
  desde?: string; // YYYY-MM-DD — period start
  hasta?: string; // YYYY-MM-DD — period end
  usuarioId?: number;
  clienteId?: number;
  tipo?: 'TODOS' | 'SERVICIOS' | 'PRODUCTOS';
}

export interface ResumenDiaOutput {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  totalCostoBaseInsumos: number;
  cantidadAtenciones: number;
  cantidadProductosVendidos: number;
  /** Ingresos devengados (informativo). */
  totalIngresos: number;
  /** Σ pagos recibidos en el período por fecha de recepción (cash basis). */
  totalCobrado: number;
  /** Σ montoPendiente de registros NO ANULADO del período (fiado del día). */
  totalFiadoDia: number;
  totalGastos: number;
  balanceNeto: number;
}

@injectable()
export class ResumenDiaUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  async execute(input: ResumenDiaInput): Promise<ResumenDiaOutput> {
    let inicio: Date;
    let fin: Date;

    if (input.desde && input.hasta) {
      // Period mode: desde -> hasta (inclusive)
      const [desdeYear, desdeMonth, desdeDay] = input.desde.split('-').map(Number);
      const [hastaYear, hastaMonth, hastaDay] = input.hasta.split('-').map(Number);

      // Start of desde day in Colombia = 05:00 UTC
      inicio = new Date(Date.UTC(desdeYear, desdeMonth - 1, desdeDay, 5, 0, 0, 0));
      // End of hasta day in Colombia = 05:00 UTC next day
      fin = new Date(Date.UTC(hastaYear, hastaMonth - 1, hastaDay + 1, 5, 0, 0, 0));
    } else {
      // Single day mode (default)
      const fecha = input.fecha ?? getColombiaDateString();
      const [year, month, day] = fecha.split('-').map(Number);

      // Start of day in Colombia = 05:00 UTC
      inicio = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
      // End of day in Colombia = 05:00 UTC next day
      fin = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));
    }

    // Decision (documented): totalGastos is NEVER filtered by empleada/cliente.
    // Expenses belong to the salon — GastoEntity has no usuarioId/clienteId, so
    // filtering them by an empleada/cliente filter would be semantically wrong.
    // The sum keeps spanning the full date range regardless of the input filters.
    const hasFiltroPersona = input.usuarioId !== undefined || input.clienteId !== undefined;

    const [registros, totalGastos, totalCobrado, totalFiadoDia] = await Promise.all([
      hasFiltroPersona
        ? this.registroRepo.search({
            salonId: input.salonId,
            desde: inicio,
            hasta: fin,
            usuarioId: input.usuarioId,
            clienteId: input.clienteId,
          })
        : this.registroRepo.findBySalonAndDateRange(input.salonId, inicio, fin),
      this.gastoRepo.sumBySalonAndDateRange(input.salonId, inicio, fin),
      // Cash basis: Σ pagos recibidos en el período (pago.creadoEn), con el mismo
      // filtro de empleada cuando el resumen se filtra por persona.
      this.registroRepo.sumPagosPorPeriodo(input.salonId, inicio, fin, input.usuarioId),
      // Fiado originado en el período (fecha de negocio de los registros).
      this.registroRepo.sumMontoPendientePorPeriodo(input.salonId, inicio, fin),
    ]);

    // ── Calcular valores ajustados por descuentos ──────────────
    // La DB guarda totalServicios/totalProductos como valores brutos (pre-descuento)
    // y valorFinal como el total realmente cobrado. Aplicamos la proporción del
    // descuento a servicios y productos por separado para mantener la consistencia.
    let totalServicios = 0;
    let totalProductos = 0;
    let totalPropinas = 0;
    let totalComisiones = 0;
    let totalCostoBaseInsumos = 0;
    let cantidadProductosVendidos = 0;
    let totalIngresos = 0;

    for (const r of registros) {
      // Skip anulled records — they should not contribute to daily summary
      if (r.estado === 'ANULADO') continue;

      const propina = Number(r.propina);
      const montoTotal = Number(r.montoTotal);

      // Contribuciones post-descuento (misma lógica compartida con el P&L mensual)
      const { servicios: servContrib, productos: prodContrib } =
        calcularContribucionesRegistro({
          totalServicios: Number(r.totalServicios),
          totalProductos: Number(r.totalProductos),
          propina,
          montoTotal,
          valorFinal: r.valorFinal != null ? Number(r.valorFinal) : montoTotal,
        });

      // Tipo filter: when SERVICIOS, product contributions are zeroed; when
      // PRODUCTOS, service contributions are zeroed. TODOS keeps both.
      totalServicios += input.tipo === 'PRODUCTOS' ? 0 : servContrib;
      totalProductos += input.tipo === 'SERVICIOS' ? 0 : prodContrib;
      totalPropinas += propina;
      totalComisiones += Number(r.comisionCalculada);
      cantidadProductosVendidos +=
        input.tipo === 'SERVICIOS' ? 0 : Number(r.cantidadProductosVendidos ?? 0);

      if (input.tipo === 'SERVICIOS') {
        totalIngresos += servContrib;
      } else if (input.tipo === 'PRODUCTOS') {
        totalIngresos += prodContrib;
      } else {
        totalIngresos += servContrib + prodContrib;
      }

      // Costo base de insumos es un costo real del salón; se suma sin ajuste por descuento
      const costoBaseItems = (r.serviciosItems ?? []).reduce(
        (sum, si) => sum + Number(si.costoBaseInsumos ?? 0),
        0,
      );
      totalCostoBaseInsumos += Math.round(costoBaseItems);
    }

    const balanceNeto = totalIngresos - totalGastos - totalComisiones - totalCostoBaseInsumos;

    return {
      totalServicios,
      totalProductos,
      totalPropinas,
      totalComisiones,
      totalCostoBaseInsumos,
      cantidadAtenciones:
        input.tipo === 'PRODUCTOS'
          ? 0
          : registros.filter(
              (r) => r.estado !== 'ANULADO' && Number(r.totalServicios) > 0,
            ).length,
      cantidadProductosVendidos,
      totalIngresos,
      totalCobrado,
      totalFiadoDia,
      totalGastos,
      balanceNeto,
    };
  }
}
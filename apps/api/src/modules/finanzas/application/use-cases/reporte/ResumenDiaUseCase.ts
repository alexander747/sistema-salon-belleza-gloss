import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';

export interface ResumenDiaInput {
  salonId: number;
  fecha?: string; // YYYY-MM-DD (Colombia date) — single day
  desde?: string; // YYYY-MM-DD — period start
  hasta?: string; // YYYY-MM-DD — period end
}

export interface ResumenDiaOutput {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  cantidadAtenciones: number;
  cantidadProductosVendidos: number;
  totalIngresos: number;
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

    const [registros, totalGastos] = await Promise.all([
      this.registroRepo.findBySalonAndDateRange(input.salonId, inicio, fin),
      this.gastoRepo.sumBySalonAndDateRange(input.salonId, inicio, fin),
    ]);

    // ── Calcular valores ajustados por descuentos ──────────────
    // La DB guarda totalServicios/totalProductos como valores brutos (pre-descuento)
    // y valorFinal como el total realmente cobrado. Aplicamos la proporción del
    // descuento a servicios y productos por separado para mantener la consistencia.
    let totalServicios = 0;
    let totalProductos = 0;
    let totalPropinas = 0;
    let totalComisiones = 0;
    let cantidadProductosVendidos = 0;
    let totalIngresos = 0;

    for (const r of registros) {
      // Skip anulled records — they should not contribute to daily summary
      if (r.estado === 'ANULADO') continue;

      const servBruto = Number(r.totalServicios);
      const prodBruto = Number(r.totalProductos);
      const propina = Number(r.propina);
      const montoTotal = Number(r.montoTotal);
      const valorFinal = Number(r.valorFinal ?? montoTotal);

      // Proporción del descuento sobre (servicios + productos), excluyendo propina
      const baseBruta = montoTotal - propina; // serv + prod brutos
      const baseReal = valorFinal - propina;  // serv + prod reales (post-descuento)
      const proporcion = baseBruta > 0 ? baseReal / baseBruta : 1;

      totalServicios += Math.round(servBruto * proporcion);
      totalProductos += Math.round(prodBruto * proporcion);
      totalPropinas += propina;
      totalComisiones += Number(r.comisionCalculada);
      cantidadProductosVendidos += Number(r.cantidadProductosVendidos ?? 0);
      totalIngresos += Math.round((servBruto + prodBruto) * proporcion);
    }

    const balanceNeto = totalIngresos - totalGastos;

    return {
      totalServicios,
      totalProductos,
      totalPropinas,
      totalComisiones,
      cantidadAtenciones: registros.filter(
        (r) => r.estado !== 'ANULADO' && Number(r.totalServicios) > 0,
      ).length,
      cantidadProductosVendidos,
      totalIngresos,
      totalGastos,
      balanceNeto,
    };
  }
}

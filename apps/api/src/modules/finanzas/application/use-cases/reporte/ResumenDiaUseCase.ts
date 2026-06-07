import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';

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
}

@injectable()
export class ResumenDiaUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
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
      const fecha = input.fecha ?? new Date().toISOString().slice(0, 10);
      const [year, month, day] = fecha.split('-').map(Number);

      // Start of day in Colombia = 05:00 UTC
      inicio = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
      // End of day in Colombia = 05:00 UTC next day
      fin = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));
    }

    const registros = await this.registroRepo.findBySalonAndDateRange(
      input.salonId,
      inicio,
      fin,
    );

    const totalServicios = registros.reduce(
      (sum, r) => sum + Number(r.totalServicios), 0,
    );
    const totalProductos = registros.reduce(
      (sum, r) => sum + Number(r.totalProductos), 0,
    );
    const totalPropinas = registros.reduce(
      (sum, r) => sum + Number(r.propina), 0,
    );
    const totalComisiones = registros.reduce(
      (sum, r) => sum + Number(r.comisionCalculada), 0,
    );
    const cantidadProductosVendidos = registros.reduce(
      (sum, r) => sum + Number(r.cantidadProductosVendidos ?? 0), 0,
    );

    return {
      totalServicios,
      totalProductos,
      totalPropinas,
      totalComisiones,
      cantidadAtenciones: registros.length,
      cantidadProductosVendidos,
      totalIngresos: totalServicios + totalProductos,
    };
  }
}

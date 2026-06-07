import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';

export interface ResumenDiaInput {
  salonId: number;
  fecha: string; // YYYY-MM-DD (Colombia date)
}

export interface ResumenDiaOutput {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  cantidadAtenciones: number;
  totalIngresos: number;
}

@injectable()
export class ResumenDiaUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: ResumenDiaInput): Promise<ResumenDiaOutput> {
    // Colombia is UTC-5, so a day in Colombia runs from 05:00 UTC to 05:00 UTC next day
    // Parse YYYY-MM-DD
    const [year, month, day] = input.fecha.split('-').map(Number);

    // Start of day in Colombia = 05:00 UTC
    const inicio = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));

    // End of day in Colombia = 05:00 UTC next day
    const fin = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));

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

    return {
      totalServicios,
      totalProductos,
      totalPropinas,
      totalComisiones,
      cantidadAtenciones: registros.length,
      totalIngresos: totalServicios + totalProductos,
    };
  }
}

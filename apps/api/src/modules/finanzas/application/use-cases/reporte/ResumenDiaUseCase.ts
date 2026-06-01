import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';

export interface ResumenDiaInput {
  salonId: number;
  fecha: Date;
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
    const inicio = new Date(input.fecha);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(input.fecha);
    fin.setHours(23, 59, 59, 999);

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

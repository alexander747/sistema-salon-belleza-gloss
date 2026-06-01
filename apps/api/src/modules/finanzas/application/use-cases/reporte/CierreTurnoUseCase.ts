import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';

export interface CierreTurnoInput {
  salonId: number;
  usuarioId: number;
  fecha: Date;
}

export interface CierreTurnoOutput {
  serviciosRealizados: number;
  productosVendidos: number;
  comisionGanada: number;
  propinasRecibidas: number;
  totalACobrar: number;
  totalAEntregar: number;
}

@injectable()
export class CierreTurnoUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: CierreTurnoInput): Promise<CierreTurnoOutput> {
    const inicio = new Date(input.fecha);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(input.fecha);
    fin.setHours(23, 59, 59, 999);

    const registros = await this.registroRepo.search({
      salonId: input.salonId,
      usuarioId: input.usuarioId,
      desde: inicio,
      hasta: fin,
    });

    const serviciosRealizados = registros.length;

    const productosVendidos = registros.reduce(
      (sum, r) => sum + Number(r.totalProductos), 0,
    );
    const comisionGanada = registros.reduce(
      (sum, r) => sum + Number(r.comisionCalculada), 0,
    );
    const propinasRecibidas = registros.reduce(
      (sum, r) => sum + Number(r.propina), 0,
    );
    const totalMonto = registros.reduce(
      (sum, r) => sum + Number(r.montoTotal), 0,
    );

    const totalACobrar = comisionGanada + propinasRecibidas;
    // montoTotal - comision - propina = what employee delivers to salon
    const totalAEntregar = totalMonto - comisionGanada - propinasRecibidas;

    return {
      serviciosRealizados,
      productosVendidos,
      comisionGanada,
      propinasRecibidas,
      totalACobrar: Number(totalACobrar.toFixed(2)),
      totalAEntregar: Number(totalAEntregar.toFixed(2)),
    };
  }
}

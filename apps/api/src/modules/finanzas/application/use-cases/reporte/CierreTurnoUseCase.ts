import { injectable, inject } from 'tsyringe';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
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

    const registros = (await this.registroRepo.search({
      salonId: input.salonId,
      usuarioId: input.usuarioId,
      desde: inicio,
      hasta: fin,
    })).filter((r) => r.estado !== EstadoRegistro.ANULADO);

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
    // Contabilidad de CAJA: lo que el empleado debe entregar es lo COBRADO
    // (Σ pagos reales), no el monto total — con fiado/parcial el monto total
    // pediría entregar dinero que nunca se recibió. r.pagos ya viene cargado
    // por search; los pagos de registros ANULADO quedan fuera (registros
    // filtrados arriba).
    const totalCobrado = registros.reduce(
      (sum, r) => sum + (r.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0),
      0,
    );

    const totalACobrar = comisionGanada + propinasRecibidas;
    // cobrado − comisión − propina = lo que el empleado entrega al salón
    const totalAEntregar = totalCobrado - comisionGanada - propinasRecibidas;

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

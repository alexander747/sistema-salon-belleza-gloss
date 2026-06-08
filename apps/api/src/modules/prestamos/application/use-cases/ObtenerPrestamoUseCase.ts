import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import type { IPagoPrestamoRepository } from '../../domain/ports/IPagoPrestamoRepository';
import { NotFoundError } from '../../../../shared/errors';

export interface PrestamoDetalleDTO {
  id: number;
  salonId: number;
  usuarioId: number | null;
  nombreEmpleado: string | null;
  nombreTercero: string | null;
  monto: number;
  saldoPendiente: number;
  motivo: string | null;
  estado: string;
  fechaCreacion: string;
  creadoEn: string;
  actualizadoEn: string;
  pagos: Array<{
    id: number;
    monto: number;
    fechaPago: string;
    tipoPago: string;
    liquidacionId: number | null;
    observacion: string | null;
    creadoEn: string;
  }>;
}

@injectable()
export class ObtenerPrestamoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
    @inject('IPagoPrestamoRepository')
    private readonly pagoRepo: IPagoPrestamoRepository,
  ) {}

  async execute(prestamoId: number): Promise<PrestamoDetalleDTO> {
    const prestamo = await this.prestamoRepo.findById(prestamoId);
    if (!prestamo) {
      throw new NotFoundError('Préstamo no encontrado');
    }

    const pagos = await this.pagoRepo.findByPrestamo(prestamoId);

    return {
      id: prestamo.id,
      salonId: prestamo.salonId,
      usuarioId: prestamo.usuarioId,
      nombreEmpleado: prestamo.usuario?.nombre ?? null,
      nombreTercero: prestamo.nombreTercero,
      monto: Number(prestamo.monto),
      saldoPendiente: Number(prestamo.saldoPendiente),
      motivo: prestamo.motivo,
      estado: prestamo.estado,
      fechaCreacion: prestamo.fechaCreacion?.toISOString?.() ?? String(prestamo.fechaCreacion),
      creadoEn: prestamo.creadoEn?.toISOString?.() ?? String(prestamo.creadoEn),
      actualizadoEn: prestamo.actualizadoEn?.toISOString?.() ?? String(prestamo.actualizadoEn),
      pagos: pagos.map((p) => ({
        id: p.id,
        monto: Number(p.monto),
        fechaPago: p.fechaPago?.toISOString?.() ?? String(p.fechaPago),
        tipoPago: p.tipoPago,
        liquidacionId: p.liquidacionId,
        observacion: p.observacion,
        creadoEn: p.creadoEn?.toISOString?.() ?? String(p.creadoEn),
      })),
    };
  }
}

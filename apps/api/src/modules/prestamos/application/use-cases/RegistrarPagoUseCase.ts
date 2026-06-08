import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import type { IPagoPrestamoRepository } from '../../domain/ports/IPagoPrestamoRepository';
import type { RegistrarPagoInput } from '../dtos/RegistrarPagoDTO';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../../../shared/errors';

@injectable()
export class RegistrarPagoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
    @inject('IPagoPrestamoRepository')
    private readonly pagoRepo: IPagoPrestamoRepository,
  ) {}

  async execute(input: RegistrarPagoInput): Promise<Record<string, unknown>> {
    const prestamo = await this.prestamoRepo.findById(input.prestamoId);
    if (!prestamo) {
      throw new NotFoundError('Préstamo no encontrado');
    }
    if (prestamo.estado !== 'ACTIVO') {
      throw new UnprocessableEntityError('El préstamo no está activo');
    }
    if (input.monto <= 0) {
      throw new ValidationError('El monto del pago debe ser positivo');
    }
    if (input.monto > Number(prestamo.saldoPendiente)) {
      throw new ValidationError('El monto del pago no puede exceder el saldo pendiente');
    }

    const pago = await this.pagoRepo.create({
      prestamoId: input.prestamoId,
      monto: input.monto,
      tipoPago: input.tipoPago ?? 'MANUAL',
      liquidacionId: input.liquidacionId ?? undefined,
      observacion: input.observacion ?? undefined,
      fechaPago: new Date(),
    });

    // Actualizar saldo pendiente
    const nuevoSaldo = Number(prestamo.saldoPendiente) - input.monto;
    const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADO' : 'ACTIVO';

    await this.prestamoRepo.update(input.prestamoId, {
      saldoPendiente: Math.max(0, nuevoSaldo),
      estado: nuevoEstado,
    });

    return {
      id: pago.id,
      prestamoId: pago.prestamoId,
      monto: Number(pago.monto),
      fechaPago: pago.fechaPago?.toISOString?.() ?? String(pago.fechaPago),
      tipoPago: pago.tipoPago,
      liquidacionId: pago.liquidacionId,
      observacion: pago.observacion,
      creadoEn: pago.creadoEn?.toISOString?.() ?? String(pago.creadoEn),
      saldoRestante: Math.max(0, nuevoSaldo),
      nuevoEstado,
    };
  }
}

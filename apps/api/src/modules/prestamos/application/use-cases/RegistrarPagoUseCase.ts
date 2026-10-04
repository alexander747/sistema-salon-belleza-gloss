import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import type { IPagoPrestamoRepository } from '../../domain/ports/IPagoPrestamoRepository';
import type { ICajaRepository } from '../../../finanzas/domain/ports/ICajaRepository';
import type { RegistrarPagoInput } from '../dtos/RegistrarPagoDTO';
import { MetodoPago } from '../../../../infrastructure/persistence/entities/MetodoPago';
import { getColombiaDateString } from '../../../../shared/colombia-date';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../../../shared/errors';

@injectable()
export class RegistrarPagoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
    @inject('IPagoPrestamoRepository')
    private readonly pagoRepo: IPagoPrestamoRepository,
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
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

    // Rule C (corregido): "Préstamos" son cuentas por COBRAR — el pago del
    // deudor es un INGRESO. Si es en EFECTIVO ENTRA al cajón y SUMA al arqueo
    // del día. Se liga a la caja ABIERTA de hoy (si no hay, cajaId NULL — igual
    // que un ingreso sin caja no entra al arqueo).
    //
    // Nuance (follow-up): contablemente solo el INTERÉS de un préstamo es
    // ingreso operativo; el capital es recuperación de una cuenta por cobrar.
    // El modelo actual no separa ambos, así que se registra el flujo de caja
    // completo y se deja la distinción capital/interés como deuda técnica.
    const metodoPago = input.metodoPago ?? MetodoPago.EFECTIVO;
    const caja = await this.cajaRepo.findAbiertaBySalonYFecha(
      prestamo.salonId,
      getColombiaDateString(),
    );

    const pago = await this.pagoRepo.create({
      prestamoId: input.prestamoId,
      monto: input.monto,
      tipoPago: input.tipoPago ?? 'MANUAL',
      liquidacionId: input.liquidacionId ?? undefined,
      observacion: input.observacion ?? undefined,
      fechaPago: new Date(),
      metodoPago,
      cajaId: caja?.id ?? null,
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
      metodoPago: pago.metodoPago,
      cajaId: pago.cajaId,
      creadoEn: pago.creadoEn?.toISOString?.() ?? String(pago.creadoEn),
      saldoRestante: Math.max(0, nuevoSaldo),
      nuevoEstado,
    };
  }
}

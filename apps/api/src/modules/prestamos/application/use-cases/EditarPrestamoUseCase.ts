import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import { NotFoundError, UnprocessableEntityError } from '../../../../shared/errors';

export interface EditarPrestamoInput {
  prestamoId: number;
  motivo?: string;
  monto?: number;
}

@injectable()
export class EditarPrestamoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
  ) {}

  async execute(input: EditarPrestamoInput): Promise<Record<string, unknown>> {
    const prestamo = await this.prestamoRepo.findById(input.prestamoId);
    if (!prestamo) {
      throw new NotFoundError('Préstamo no encontrado');
    }
    if (prestamo.estado !== 'ACTIVO') {
      throw new UnprocessableEntityError('Solo se pueden editar préstamos activos');
    }

    const updateData: Record<string, unknown> = {};
    if (input.motivo !== undefined) updateData.motivo = input.motivo;
    if (input.monto !== undefined) {
      // Si cambia el monto, ajustar saldo pendiente proporcionalmente
      const diferencia = input.monto - Number(prestamo.monto);
      const nuevoSaldo = Number(prestamo.saldoPendiente) + diferencia;
      updateData.monto = input.monto;
      updateData.saldoPendiente = Math.max(0, nuevoSaldo);
    }

    const updated = await this.prestamoRepo.update(input.prestamoId, updateData);
    return {
      id: updated!.id,
      monto: Number(updated!.monto),
      saldoPendiente: Number(updated!.saldoPendiente),
      motivo: updated!.motivo,
      estado: updated!.estado,
    };
  }
}

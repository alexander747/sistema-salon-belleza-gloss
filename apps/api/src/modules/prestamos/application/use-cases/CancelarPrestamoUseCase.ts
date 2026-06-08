import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import { NotFoundError, UnprocessableEntityError } from '../../../../shared/errors';

@injectable()
export class CancelarPrestamoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
  ) {}

  async execute(prestamoId: number): Promise<{ id: number; estado: string }> {
    const prestamo = await this.prestamoRepo.findById(prestamoId);
    if (!prestamo) {
      throw new NotFoundError('Préstamo no encontrado');
    }
    if (prestamo.estado !== 'ACTIVO') {
      throw new UnprocessableEntityError('Solo se pueden cancelar préstamos activos');
    }

    await this.prestamoRepo.update(prestamoId, {
      estado: 'CANCELADO',
    });

    return { id: prestamoId, estado: 'CANCELADO' };
  }
}

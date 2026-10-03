import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import type { IGastoRepository } from '../../../finanzas/domain/ports/IGastoRepository';
import { NotFoundError, UnprocessableEntityError } from '../../../../shared/errors';

@injectable()
export class CancelarPrestamoUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
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

    // Revertir el egreso creado junto al préstamo, para que caja/reportes
    // no queden con un gasto de un préstamo ya cancelado.
    const gastoVinculado = await this.gastoRepo.findByPrestamoId(prestamoId);
    if (gastoVinculado) {
      await this.gastoRepo.delete(gastoVinculado.id);
    }

    return { id: prestamoId, estado: 'CANCELADO' };
  }
}

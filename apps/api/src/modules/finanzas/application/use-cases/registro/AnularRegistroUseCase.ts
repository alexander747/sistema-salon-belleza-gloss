import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import { RegistroProductoEntity } from '../../../../../infrastructure/persistence/entities/RegistroProductoEntity';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import { NotFoundError } from '../../../../../shared/errors';

export interface AnularRegistroInput {
  id: number;
  salonId: number;
}

@injectable()
export class AnularRegistroUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IClienteRepository')
    private readonly clienteRepo: IClienteRepository,
    @inject('IProductoRepository')
    private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: AnularRegistroInput): Promise<void> {
    const registro = await this.registroRepo.findById(input.id);
    if (!registro) {
      throw new NotFoundError('Registro no encontrado');
    }

    // --- Stock restoration from product lines ---
    if (registro.productosVendidos && registro.productosVendidos.length > 0) {
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const rp of registro.productosVendidos) {
          await this.productoRepo.incrementStock(
            rp.productoId,
            rp.cantidad,
            undefined,
            queryRunner,
          );
          // Delete the product line
          await queryRunner.manager
            .getRepository(RegistroProductoEntity)
            .delete(rp.id);
        }
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    // Soft-void: zero out financial impact, preserve audit trail
    const montoPendienteAnterior = Number(registro.montoPendiente);

    await this.registroRepo.update(input.id, {
      montoPendiente: 0,
      montoTotal: 0,
      comisionCalculada: 0,
      estaPagadaEmpleada: true,
      notas: registro.notas
        ? `[ANULADO] ${registro.notas}`
        : '[ANULADO]',
    });

    // Decrement cliente's debt by the previous pending amount
    if (montoPendienteAnterior > 0) {
      const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, registro.clienteId);
      if (cliente) {
        const nuevaDeuda = Math.max(0, Number(cliente.deudaTotal ?? 0) - montoPendienteAnterior);
        await this.clienteRepo.update(cliente.id, {
          deudaTotal: nuevaDeuda,
        });
      }
    }
  }
}

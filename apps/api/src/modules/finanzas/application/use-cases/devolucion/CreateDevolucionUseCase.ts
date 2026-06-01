import { injectable, inject } from 'tsyringe';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { IProductoRepository } from '../../../../catalogo/domain/ports/IProductoRepository';
import type { DevolucionEntity } from '../../../../../infrastructure/persistence/entities/DevolucionEntity';

export interface CreateDevolucionInput {
  salonId: number;
  registroServicioId: number;
  motivo: string;
  cantidad: number;
  montoDevolucion: number;
  regresaAlStock: boolean;
  productoId?: number;
  procesada?: boolean;
}

@injectable()
export class CreateDevolucionUseCase {
  constructor(
    @inject('IDevolucionRepository')
    private readonly devolucionRepo: IDevolucionRepository,
    @inject('IProductoRepository')
    private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: CreateDevolucionInput): Promise<DevolucionEntity> {
    const devolucion = await this.devolucionRepo.create({
      salonId: input.salonId,
      registroServicioId: input.registroServicioId,
      motivo: input.motivo,
      cantidad: input.cantidad,
      montoDevolucion: input.montoDevolucion,
      regresaAlStock: input.regresaAlStock,
      productoId: input.productoId,
      procesada: input.procesada ?? false,
    });

    // If regresaAlStock is true and a productId was provided, increment stock
    if (input.regresaAlStock && input.productoId) {
      await this.productoRepo.incrementStock(input.productoId, input.cantidad);
    }

    return devolucion;
  }
}

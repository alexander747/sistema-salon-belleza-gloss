import { injectable, inject } from 'tsyringe';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { GastoEntity } from '../../../../../infrastructure/persistence/entities/GastoEntity';
import { MetodoPago } from '../../../../../infrastructure/persistence/entities/PagoTransaccionEntity';

export interface CreateGastoInput {
  salonId: number;
  descripcion: string;
  monto: number;
  metodoPago: MetodoPago;
  esGastoFijo: boolean;
  categoria?: string;
  reportadoPorId?: number;
}

@injectable()
export class CreateGastoUseCase {
  constructor(
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  async execute(input: CreateGastoInput): Promise<GastoEntity> {
    return this.gastoRepo.create({
      salonId: input.salonId,
      descripcion: input.descripcion,
      monto: input.monto,
      metodoPago: input.metodoPago,
      esGastoFijo: input.esGastoFijo,
      categoria: input.categoria,
      reportadoPorId: input.reportadoPorId,
      fecha: new Date(),
    });
  }
}

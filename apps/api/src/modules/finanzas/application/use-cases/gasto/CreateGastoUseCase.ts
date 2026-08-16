import { injectable, inject } from 'tsyringe';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { GastoEntity } from '../../../../../infrastructure/persistence/entities/GastoEntity';
import { MetodoPago } from '../../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { getColombiaDateString } from '../../../../../shared/colombia-date';

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
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: CreateGastoInput): Promise<GastoEntity> {
    // Asociar la caja abierta del día si existe (NO es un chokepoint: los
    // gastos se pueden registrar sin caja abierta, spec gastos).
    const caja = await this.cajaRepo.findAbiertaBySalonYFecha(
      input.salonId,
      getColombiaDateString(),
    );

    return this.gastoRepo.create({
      salonId: input.salonId,
      descripcion: input.descripcion,
      monto: input.monto,
      metodoPago: input.metodoPago,
      esGastoFijo: input.esGastoFijo,
      categoria: input.categoria,
      reportadoPorId: input.reportadoPorId,
      cajaId: caja?.id ?? null,
      fecha: new Date(),
    });
  }
}

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
  /** Fecha de negocio YYYY-MM-DD (backfill); default = hoy en Colombia. */
  fecha?: string;
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
    // Fecha de negocio: input.fecha (backfill) ?? hoy en Colombia.
    // La caja se resuelve por ESA fecha → el gasto backfilleado cae en el
    // arqueo de la caja de su día (y en los reportes por fecha).
    const fecha = input.fecha ?? getColombiaDateString();
    const caja = await this.cajaRepo.findAbiertaBySalonYFecha(input.salonId, fecha);

    return this.gastoRepo.create({
      salonId: input.salonId,
      descripcion: input.descripcion,
      monto: input.monto,
      metodoPago: input.metodoPago,
      esGastoFijo: input.esGastoFijo,
      categoria: input.categoria,
      reportadoPorId: input.reportadoPorId,
      cajaId: caja?.id ?? null,
      // Medianoche UTC: los filtros de reportes (PyL/ResumenDia) comparan
      // la columna DATE contra límites a medianoche UTC (patrón TZ-safe).
      fecha: new Date(`${fecha}T00:00:00.000Z`),
    });
  }
}

import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaNoAbiertaError } from '../../../../../shared/errors';
import { calcularReporteCierre, type ReporteCierre } from './calcularReporteCierre';

export interface ObtenerEsperadoCajaInput {
  salonId: number;
}

@injectable()
export class ObtenerEsperadoCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  /**
   * Preview del arqueo (read-only): mismo cálculo que el cierre pero sin persistir.
   * `montoRealEfectivo = null` → `diferencia` null en la respuesta.
   */
  async execute(input: ObtenerEsperadoCajaInput): Promise<ReporteCierre> {
    const caja = await this.cajaRepo.findAbiertaBySalonYFecha(input.salonId, getColombiaDateString());
    if (!caja) {
      throw new CajaNoAbiertaError();
    }

    const [registros, gastos] = await Promise.all([
      this.registroRepo.search({ salonId: input.salonId, cajaId: caja.id }),
      this.gastoRepo.findByCajaId(caja.id),
    ]);

    return calcularReporteCierre(registros, gastos, null, Number(caja.montoInicial));
  }
}

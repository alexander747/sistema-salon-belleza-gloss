import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaNoAbiertaError, CajaYaCerradaError } from '../../../../../shared/errors';
import { calcularReporteCierre } from './calcularReporteCierre';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';
import type { ReporteCierreDTO } from '../../dtos/ReporteCierreDTO';

export interface CerrarCajaInput {
  salonId: number;
  montoRealEfectivo: number;
  cierrePorId?: number | null;
}

@injectable()
export class CerrarCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  async execute(input: CerrarCajaInput): Promise<ReporteCierreDTO> {
    const fechaCaja = getColombiaDateString();
    const caja = await this.cajaRepo.findBySalonYFecha(input.salonId, fechaCaja);

    if (!caja) {
      throw new CajaNoAbiertaError();
    }
    if (caja.estado !== 'ABIERTA') {
      throw new CajaYaCerradaError();
    }

    const [registros, gastos] = await Promise.all([
      this.registroRepo.search({ salonId: input.salonId, cajaId: caja.id }),
      this.gastoRepo.findByCajaId(caja.id),
    ]);

    const reporte = calcularReporteCierre(registros, gastos, input.montoRealEfectivo, Number(caja.montoInicial));

    // UPDATE condicional: guard atómico contra doble cierre (race)
    const cerrado = await this.cajaRepo.cerrar(caja.id, {
      montoEsperado: reporte.montoEsperado,
      montoRealEfectivo: input.montoRealEfectivo,
      diferencia: reporte.diferencia ?? 0,
      cierrePorId: input.cierrePorId ?? null,
    });

    if (!cerrado) {
      // 0 filas afectadas → otra request ya cerró la caja
      throw new CajaYaCerradaError();
    }

    const cajaCerrada: CajaDTO = {
      ...cajaToDTO(caja),
      estado: 'CERRADA',
      montoEsperado: reporte.montoEsperado,
      montoRealEfectivo: input.montoRealEfectivo,
      diferencia: reporte.diferencia ?? 0,
      cierrePorId: input.cierrePorId ?? null,
      cierreEn: new Date(),
    };

    return { caja: cajaCerrada, reporte };
  }
}

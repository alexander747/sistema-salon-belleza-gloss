import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaYaAbiertaError, CajaYaCerradaError } from '../../../../../shared/errors';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';

export interface AbrirCajaInput {
  salonId: number;
  montoInicial: number;
  aperturaPorId?: number | null;
  /** Opcional (backfill): día comercial YYYY-MM-DD. Ausente → hoy Colombia. */
  fechaCaja?: string;
}

@injectable()
export class AbrirCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: AbrirCajaInput): Promise<CajaDTO> {
    const fechaCaja = input.fechaCaja ?? getColombiaDateString();

    // Cualquier caja ABIERTA del salón (cualquier fecha, incluidas huérfanas de días
    // anteriores) bloquea la apertura: el negocio debe cerrar la pendiente primero.
    const abierta = await this.cajaRepo.findAbiertaBySalon(input.salonId);
    if (abierta) {
      throw new CajaYaAbiertaError(
        'Ya existe una caja abierta — cerrá la caja pendiente antes de abrir una nueva',
      );
    }

    const existente = await this.cajaRepo.findBySalonYFecha(input.salonId, fechaCaja);
    if (existente) {
      // Una caja por día comercial; no se reabre
      throw new CajaYaCerradaError(`La caja de la fecha ${fechaCaja} ya está cerrada`);
    }

    try {
      const caja = await this.cajaRepo.create({
        salonId: input.salonId,
        fechaCaja,
        montoInicial: input.montoInicial,
        estado: 'ABIERTA',
        aperturaPorId: input.aperturaPorId ?? null,
        aperturaEn: new Date(),
      });
      return cajaToDTO(caja);
    } catch (error) {
      // Backstop race de apertura: otra request insertó entre el check y el create
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
        const actual = await this.cajaRepo.findBySalonYFecha(input.salonId, fechaCaja);
        if (actual?.estado === 'ABIERTA') {
          throw new CajaYaAbiertaError(`Ya existe una caja abierta para la fecha ${fechaCaja}`);
        }
        throw new CajaYaCerradaError(`La caja de la fecha ${fechaCaja} ya está cerrada`);
      }
      throw error;
    }
  }
}

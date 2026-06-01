import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import { CitaDTO } from '../../dtos/CitaDTO';
import { DisponibilidadService } from '../../services/DisponibilidadService';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IServicioRepository } from '../../../../catalogo/domain/ports/IServicioRepository';
import type { ServicioEntity } from '../../../../../infrastructure/persistence/entities/ServicioEntity';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

export interface CreateCitaInput {
  salonId: number;
  usuarioId: number;
  clienteId: number;
  fechaHora: Date;
  servicioIds: number[];
  notas?: string;
  esWalkIn?: boolean;
}

@injectable()
export class CreateCitaUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
    @inject(DisponibilidadService) private readonly disponibilidadService: DisponibilidadService,
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
    @inject('IServicioRepository') private readonly servicioRepo: IServicioRepository,
  ) {}

  async execute(input: CreateCitaInput): Promise<CitaDTO> {
    // ── 1. Validate cliente exists ────────────────────
    const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, input.clienteId);
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    // ── 2. Validate usuario (employee) exists ─────────
    const usuario = await this.usuarioRepo.findBySalonAndId(input.salonId, input.usuarioId);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // ── 3. Validate servicios exist ───────────────────
    const servicios = await Promise.all(
      input.servicioIds.map((id) => this.servicioRepo.findBySalonAndId(input.salonId, id)),
    );

    const missingIdx = servicios.findIndex((s) => !s);
    if (missingIdx !== -1) {
      throw new NotFoundError(`Servicio con ID ${input.servicioIds[missingIdx]} no encontrado`);
    }

    const valids = servicios as ServicioEntity[];

    const duracionTotal = valids.reduce((sum, s) => sum + s.duracionMinutos, 0);

    // ── 4. Check disponibilidad ───────────────────────
    const disponibilidad = await this.disponibilidadService.verificar(
      input.salonId,
      input.usuarioId,
      input.fechaHora,
      duracionTotal,
    );

    if (!disponibilidad.disponible) {
      throw new UnprocessableEntityError(disponibilidad.motivo);
    }

    // ── 5. Create cita ────────────────────────────────
    const cita = await this.citaRepo.create({
      salonId: input.salonId,
      usuarioId: input.usuarioId,
      clienteId: input.clienteId,
      fechaHora: input.fechaHora,
      notas: input.notas ?? undefined,
      esWalkIn: input.esWalkIn ?? false,
      estado: EstadoCita.PENDIENTE,
      servicios: valids,
    });

    return CitaDTO.fromEntity(cita);
  }
}

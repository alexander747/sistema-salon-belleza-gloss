import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import { CitaDTO } from '../../dtos/CitaDTO';
import { DisponibilidadService } from '../../services/DisponibilidadService';
import type { IClienteRepository } from '../../../../personas/domain/ports/IClienteRepository';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IServicioRepository } from '../../../../catalogo/domain/ports/IServicioRepository';
import type { ServicioEntity } from '../../../../../infrastructure/persistence/entities/ServicioEntity';
import { CitaServicioEntity } from '../../../../../infrastructure/persistence/entities/CitaServicioEntity';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

export interface CreateCitaServicioInput {
  servicioId: number;
  cantidad: number;
}

export interface CreateCitaInput {
  salonId: number;
  usuarioId: number;
  clienteId: number;
  fechaHora: Date;
  /** Líneas de servicio con cantidad (se expande en duración y persistencia). */
  servicios: CreateCitaServicioInput[];
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
      input.servicios.map((linea) =>
        this.servicioRepo.findBySalonAndId(input.salonId, linea.servicioId),
      ),
    );

    const missingIdx = servicios.findIndex((s) => !s);
    if (missingIdx !== -1) {
      throw new NotFoundError(`Servicio con ID ${input.servicios[missingIdx].servicioId} no encontrado`);
    }

    const valids = servicios as ServicioEntity[];

    // Duración expandida: Σ(duracionMinutos × cantidad) — el overlap usa este valor.
    const duracionTotal = valids.reduce(
      (sum, s, i) => sum + s.duracionMinutos * input.servicios[i].cantidad,
      0,
    );

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

    // ── 5. Create cita (explicit join, cascade) ───────
    const citasServicios = valids.map((servicio, i) => {
      const linea = new CitaServicioEntity();
      linea.serviciosId = servicio.id;
      linea.cantidad = input.servicios[i].cantidad;
      linea.servicio = servicio;
      return linea;
    });

    const cita = await this.citaRepo.create({
      salonId: input.salonId,
      usuarioId: input.usuarioId,
      clienteId: input.clienteId,
      fechaHora: input.fechaHora,
      notas: input.notas ?? undefined,
      esWalkIn: input.esWalkIn ?? false,
      estado: EstadoCita.PENDIENTE,
      citasServicios,
    });

    return CitaDTO.fromEntity(cita);
  }
}

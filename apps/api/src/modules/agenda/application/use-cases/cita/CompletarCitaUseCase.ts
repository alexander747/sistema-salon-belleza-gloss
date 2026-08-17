import { injectable, inject } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import type { ICajaRepository } from '../../../../finanzas/domain/ports/ICajaRepository';
import { verificarCajaAbierta } from '../../../../finanzas/application/services/verificarCajaAbierta';
import { CitaDTO } from '../../dtos/CitaDTO';
import { cambiarEstado } from '../../../domain/state-machine';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';
import {
  CreateRegistroUseCase,
  type CreateRegistroInputConCita,
} from '../../../../finanzas/application/use-cases/registro/CreateRegistroUseCase';
import type { RegistroServicioDTO } from '../../../../finanzas/application/dtos/RegistroServicioDTO';
import { AppDataSource } from '../../../../../shared/database';

export interface CompletarCitaInput {
  id: number;
  usuarioId?: number;
  registro?: CreateRegistroInputConCita;
}

export type CompletarCitaResult = CitaDTO | { cita: CitaDTO; registro: RegistroServicioDTO };

@injectable()
export class CompletarCitaUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
    @inject('ICajaRepository') private readonly cajaRepo: ICajaRepository,
    @inject(CreateRegistroUseCase) private readonly createRegistroUseCase: CreateRegistroUseCase,
  ) {}

  async execute(input: CompletarCitaInput): Promise<CompletarCitaResult> {
    const cita = await this.citaRepo.findById(input.id);
    if (!cita) {
      throw new NotFoundError('Cita no encontrada');
    }

    // Regla de oro: no se completa una cita (venta) sin caja abierta.
    // La cita permanece en su estado previo si no hay caja.
    await verificarCajaAbierta(this.cajaRepo, cita.salonId);

    // Validar la transición EN MEMORIA antes de escribir nada.
    // Reintentar sobre una COMPLETADA o completar una PENDIENTE → 422 y
    // NINGUNA escritura (garantiza que el reintento no duplique registros).
    try {
      cambiarEstado(cita, EstadoCita.COMPLETADA);
    } catch {
      throw new UnprocessableEntityError(
        `Transición inválida: de ${cita.estado} a ${EstadoCita.COMPLETADA}. ` +
        `Solo una cita CONFIRMADA puede completarse.`,
      );
    }

    // ── Legacy path: sin registro → solo cambia el estado (sin transacción) ──
    if (!input.registro) {
      const updated = await this.citaRepo.cambiarEstado(input.id, EstadoCita.COMPLETADA, {
        completadoPorId: input.usuarioId,
      });
      return CitaDTO.fromEntity(updated!);
    }

    // ── Atomic path: registro + estado en UNA sola transacción ──
    // CompletarCitaUseCase es dueño del queryRunner: lo abre, commitea y libera.
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // salonId SIEMPRE desde la cita — el cliente nunca decide el salón.
      // citaId se inyecta para el linkage go-forward.
      const registro = await this.createRegistroUseCase.execute(
        { ...input.registro, salonId: cita.salonId, citaId: cita.id },
        queryRunner,
      );

      await this.citaRepo.cambiarEstado(
        input.id,
        EstadoCita.COMPLETADA,
        { completadoPorId: input.usuarioId },
        queryRunner,
      );

      await queryRunner.commitTransaction();

      // READ-AFTER-WRITE: re-fetch con repo default DESPUÉS del commit
      // (dentro de la tx el estado podría estar cacheado/stale).
      const updatedCita = await this.citaRepo.findById(input.id);
      return {
        cita: CitaDTO.fromEntity(updatedCita!),
        registro,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

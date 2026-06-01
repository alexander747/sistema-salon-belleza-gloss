import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';

export interface NominaPendienteEmpleada {
  empleadaId: number;
  nombre: string;
  totalComisionesPendientes: number;
  totalPropinas: number;
  bonoHorario: number;
  sueldoFijo: number;
  totalAPagar: number;
  cantidadRegistros: number;
}

export interface NominaPendienteInput {
  salonId: number;
}

@injectable()
export class NominaPendienteUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository')
    private readonly usuarioRepo: IUsuarioRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: NominaPendienteInput): Promise<NominaPendienteEmpleada[]> {
    // 1. Get all active manicuristas in the salon
    const empleadas = await this.usuarioRepo.findBySalon(
      input.salonId,
      Rol.MANICURISTA,
      true, // activo
    );

    // 2. Get all registros for the salon (to filter pending ones per empleada)
    const allRegistros = await this.registroRepo.findBySalon(input.salonId);

    // 3. Map each empleada to their pending summary
    const result: NominaPendienteEmpleada[] = [];

    for (const empleada of empleadas) {
      const pendingRegistros = allRegistros.filter(
        (r) => r.usuarioId === empleada.id && !r.estaPagadaEmpleada,
      );

      if (pendingRegistros.length === 0) {
        // Employee has no pending work registros — do not appear in pending list
        continue;
      }

      const totalComisionesPendientes = pendingRegistros.reduce(
        (sum, r) => sum + Number(r.comisionCalculada),
        0,
      );
      const totalPropinas = pendingRegistros.reduce(
        (sum, r) => sum + Number(r.propina),
        0,
      );

      result.push({
        empleadaId: empleada.id,
        nombre: empleada.nombre,
        totalComisionesPendientes,
        totalPropinas,
        bonoHorario: Number(empleada.bonoHorario),
        sueldoFijo: Number(empleada.sueldoFijo),
        totalAPagar:
          totalComisionesPendientes +
          totalPropinas +
          Number(empleada.bonoHorario) +
          Number(empleada.sueldoFijo),
        cantidadRegistros: pendingRegistros.length,
      });
    }

    return result;
  }
}

import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../../personas/domain/ports/IUsuarioRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';

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
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
  ) {}

  async execute(input: NominaPendienteInput): Promise<NominaPendienteEmpleada[]> {
    // 1. Get all active manicuristas in the salon
    const empleadas = await this.usuarioRepo.findBySalon(
      input.salonId,
      Rol.MANICURISTA,
      true, // activo
    );

    // Calculate current month period
    const now = new Date();
    const periodoInicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodoFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 2. Get all registros for the salon
    const allRegistros = await this.registroRepo.findBySalon(input.salonId);

    // 3. Map each empleada to their pending summary
    const result: NominaPendienteEmpleada[] = [];

    for (const empleada of empleadas) {
      // Get pending (unpaid) registros for this employee
      let pendingRegistros = allRegistros.filter(
        (r) => r.usuarioId === empleada.id && !r.estaPagadaEmpleada,
      );

      if (pendingRegistros.length === 0) {
        continue;
      }

      // If already liquidated this month, only include registros created AFTER the last liquidation
      const liquidaciones = await this.liquidacionRepo.findBySalonEmpleadaAndPeriodo(
        input.salonId,
        empleada.id,
        periodoInicio,
        periodoFin,
      );
      if (liquidaciones.length > 0) {
        const ultimaLiq = liquidaciones.sort(
          (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
        )[0];
        pendingRegistros = pendingRegistros.filter(
          (r) => new Date(r.creadoEn) > new Date(ultimaLiq.creadoEn),
        );
        if (pendingRegistros.length === 0) {
          continue; // No new registros since last liquidation
        }
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

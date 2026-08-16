import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
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
  porcentajeComisionServicio: number;
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
    // 1. Get all active employees in the salon (every role paid by the salon)
    const empleadas = await this.usuarioRepo.findBySalon(
      input.salonId,
      undefined, // todos los roles
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
      // El CONTADOR no es pagado por el salón → nunca aparece en la nómina
      if (empleada.rol === Rol.CONTADOR) {
        continue;
      }

      // Get pending (unpaid) non-anulled registros for this employee
      let pendingRegistros = allRegistros.filter(
        (r) => r.usuarioId === empleada.id && !r.estaPagadaEmpleada && r.estado !== EstadoRegistro.ANULADO,
      );

      // Skip only when there is NOTHING liquidable: no pending registros
      // AND no fixed compensation (sueldoFijo / bonoHorario)
      if (
        pendingRegistros.length === 0 &&
        Number(empleada.sueldoFijo) <= 0 &&
        Number(empleada.bonoHorario) <= 0
      ) {
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
        porcentajeComisionServicio: Number(empleada.porcentajeComisionServicio),
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

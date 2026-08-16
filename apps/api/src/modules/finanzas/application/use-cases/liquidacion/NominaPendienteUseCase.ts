import { injectable, inject } from 'tsyringe';
import { Rol, type FrecuenciaPago } from '@pos-final/types';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import {
  getColombiaDateString,
  colombiaDayStartUTC,
  colombiaDayEndUTC,
} from '../../../../../shared/colombia-date';
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
  periodoInicio: Date;
  periodoFin: Date;
  frecuenciaPago: FrecuenciaPago;
}

export interface NominaPendienteInput {
  salonId: number;
}

const FACTOR_FIJO_QUINCENAL = 0.5;

/**
 * Período de nómina de una empleada según su frecuencia de pago, en hora de Colombia.
 * - MENSUAL: del día 1 del mes a HOY (semántica preservada: el overlap del guard
 *   anti-doble-pago hace [1→hoy] ≡ [1→fin de mes]).
 * - QUINCENAL día ≤ 15: [1, 15]. QUINCENAL día ≥ 16: [16, último día del mes].
 */
export function calcularPeriodo(
  frecuenciaPago: FrecuenciaPago,
  hoy: string,
): { periodoInicio: Date; periodoFin: Date } {
  const [y, m] = hoy.split('-');

  if (frecuenciaPago === 'QUINCENAL') {
    const dia = Number(hoy.slice(8, 10));
    if (dia <= 15) {
      return {
        periodoInicio: colombiaDayStartUTC(`${y}-${m}-01`),
        periodoFin: colombiaDayEndUTC(`${y}-${m}-15`),
      };
    }
    const ultimoDia = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
    return {
      periodoInicio: colombiaDayStartUTC(`${y}-${m}-16`),
      periodoFin: colombiaDayEndUTC(`${y}-${m}-${ultimoDia}`),
    };
  }

  return {
    periodoInicio: colombiaDayStartUTC(`${y}-${m}-01`),
    periodoFin: colombiaDayEndUTC(hoy),
  };
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

    // 2. Get all registros for the salon
    const allRegistros = await this.registroRepo.findBySalon(input.salonId);

    // 3. Map each empleada to their pending summary
    const result: NominaPendienteEmpleada[] = [];

    for (const empleada of empleadas) {
      // El CONTADOR no es pagado por el salón → nunca aparece en la nómina
      if (empleada.rol === Rol.CONTADOR) {
        continue;
      }

      // Calculate the employee's period based on her payment frequency
      // (Colombia timezone; MENSUAL keeps the current month semantics)
      const frecuenciaPago: FrecuenciaPago = empleada.frecuenciaPago ?? 'MENSUAL';
      const { periodoInicio, periodoFin } = calcularPeriodo(frecuenciaPago, getColombiaDateString());

    // Get pending (unpaid) non-anulled registros for this employee
    let pendingRegistros = allRegistros.filter(
      (r) => r.usuarioId === empleada.id && !r.estaPagadaEmpleada && r.estado !== EstadoRegistro.ANULADO,
    );

    // QUINCENAL: solo cuentan los registros creados dentro de la quincena.
    // MENSUAL: comportamiento actual — todos los no pagados, sin filtro de período.
    if (frecuenciaPago === 'QUINCENAL') {
      pendingRegistros = pendingRegistros.filter(
        (r) => new Date(r.creadoEn) >= periodoInicio && new Date(r.creadoEn) <= periodoFin,
      );
    }

    // Skip only when there is NOTHING liquidable: no pending registros
    // AND no fixed compensation (sueldoFijo / bonoHorario)
    if (
      pendingRegistros.length === 0 &&
      Number(empleada.sueldoFijo) <= 0 &&
      Number(empleada.bonoHorario) <= 0
    ) {
      continue;
    }

    // If already liquidated this period, only include registros created AFTER the last liquidation
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

    // Fixed comp: 100% for MENSUAL, 50% for QUINCENAL (same factor as LiquidarEmpleada)
    const factor = frecuenciaPago === 'QUINCENAL' ? FACTOR_FIJO_QUINCENAL : 1;
    const bonoHorarioPeriodo = Number(empleada.bonoHorario) * factor;
    const sueldoFijoPeriodo = Number(empleada.sueldoFijo) * factor;

    result.push({
      empleadaId: empleada.id,
      nombre: empleada.nombre,
      totalComisionesPendientes,
      totalPropinas,
      bonoHorario: bonoHorarioPeriodo,
      sueldoFijo: sueldoFijoPeriodo,
      porcentajeComisionServicio: Number(empleada.porcentajeComisionServicio),
      totalAPagar:
        totalComisionesPendientes +
        totalPropinas +
        bonoHorarioPeriodo +
        sueldoFijoPeriodo,
      cantidadRegistros: pendingRegistros.length,
      periodoInicio,
      periodoFin,
      frecuenciaPago,
    });
    }

    return result;
  }
}

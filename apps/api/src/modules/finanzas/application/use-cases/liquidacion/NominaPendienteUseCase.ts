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
  sueldoFijoMensual: number;
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

const FACTOR_FIJO_MENSUAL = 1;
const FACTOR_FIJO_QUINCENAL = 0.5;
const FACTOR_FIJO_SEMANAL = 0.25;

/** Suma/resta días a una fecha 'YYYY-MM-DD' (maneja cruce de mes/año). */
function addDays(fecha: string, delta: number): string {
  const [year, month, day] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Período de nómina de una empleada según su frecuencia de pago, en hora de Colombia.
 * - MENSUAL: del día 1 del mes a HOY (semántica preservada: el overlap del guard
 *   anti-doble-pago hace [1→hoy] ≡ [1→fin de mes]).
 * - QUINCENAL día ≤ 15: [1, 15]. QUINCENAL día ≥ 16: [16, último día del mes].
 * - SEMANAL: [lunes, domingo] de la semana actual (inclusive).
 */
export function calcularPeriodo(
  frecuenciaPago: FrecuenciaPago,
  hoy: string,
): { periodoInicio: Date; periodoFin: Date } {
  const [y, m] = hoy.split('-');

  if (frecuenciaPago === 'SEMANAL') {
    // Lunes de la semana actual desde el string COT 'hoy' con ancla a mediodía UTC
    // (evita bordes de día; Colombia sin DST — D1).
    const ancla = new Date(`${hoy}T12:00:00Z`);
    const diasDesdeLunes = (ancla.getUTCDay() + 6) % 7;
    const lunes = addDays(hoy, -diasDesdeLunes);
    const domingo = addDays(hoy, 6 - diasDesdeLunes);
    return {
      periodoInicio: colombiaDayStartUTC(lunes),
      periodoFin: colombiaDayEndUTC(domingo),
    };
  }

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

/**
 * Períodos de pago VENCIDOS sin liquidar, contados desde el fin de la última
 * liquidación hasta hoy (regla del dueño: el sueldo fijo también se acumula,
 * como lo hacen los sistemas de nómina estándar).
 *
 * - Sin liquidación previa → 1 (solo el período vigente; no se inventa deuda
 *   vieja porque no hay registro de cuándo empezó a acumular).
 * - Con liquidación → cuenta los períodos completos desde su fin + el vigente.
 *   Ej: última liq pagada hasta 31/07, hoy 28/08, MENSUAL → 2 (agosto vigente
 *   + el siguiente no arrancó) → en realidad 1... el cálculo real: inicio de
 *   acumulación = 01/08, cursor 01/08 ≤ 28/08 → 1 período. Correcto.
 */
export function periodosVencidos(
  frecuenciaPago: FrecuenciaPago,
  finUltimaLiquidacion: Date | null,
  hoy: string,
): number {
  // Sin historial de pagos → solo el período vigente
  if (!finUltimaLiquidacion) return 1;

  const hoyDate = new Date(`${hoy}T12:00:00Z`);
  const fin = new Date(finUltimaLiquidacion);

  // Primer día del período siguiente al pagado (exclusivo del pagado)
  let inicioAcumulacion: Date;
  if (frecuenciaPago === 'SEMANAL') {
    // Día siguiente al fin de la última liq
    inicioAcumulacion = new Date(fin.getTime() + 86_400_000);
  } else if (frecuenciaPago === 'QUINCENAL') {
    inicioAcumulacion = new Date(fin.getTime() + 86_400_000);
  } else {
    // MENSUAL: primer día del mes siguiente al fin de la última liq
    inicioAcumulacion = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 1));
  }

  if (inicioAcumulacion > hoyDate) return 1; // la liq cubre hasta hoy (o el futuro)

  // Contar períodos desde inicioAcumulacion hasta hoy
  let periodos = 0;
  let cursor = new Date(inicioAcumulacion);
  while (cursor <= hoyDate) {
    periodos++;
    if (frecuenciaPago === 'SEMANAL') {
      cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    } else if (frecuenciaPago === 'QUINCENAL') {
      // Avanzar 15 días (aprox; la quincena es 1-15 / 16-fin de mes)
      const dia = cursor.getUTCDate();
      if (dia <= 15) {
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 16));
      } else {
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }
    } else {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  }
  return Math.max(1, periodos);
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

    // QUINCENAL/SEMANAL: solo cuentan los registros del período por FECHA DE
    // NEGOCIO (fechaHora ?? creadoEn para legacy). MENSUAL: comportamiento
    // actual — todos los no pagados, sin filtro de período.
    let periodoMostradoInicio = periodoInicio;
    let periodoMostradoFin = periodoFin;
    if (frecuenciaPago === 'QUINCENAL' || frecuenciaPago === 'SEMANAL') {
      const delPeriodo = pendingRegistros.filter((r) => {
        const fechaNegocio = new Date(r.fechaHora ?? r.creadoEn);
        return fechaNegocio >= periodoInicio && fechaNegocio <= periodoFin;
      });

      if (delPeriodo.length > 0) {
        pendingRegistros = delPeriodo;
      } else if (pendingRegistros.length > 0) {
        // NO hay registros en el período vigente, pero la empleada tiene
        // registros PENDIENTES de períodos anteriores sin liquidar (ej. semana
        // pasada). Regla del dueño: deben aparecer porque son servicios que
        // todavía no se liquidan. Se muestra el rango real de esos registros
        // con bordes de día Colombia (consistentes con el resto del sistema).
        const fechas = pendingRegistros.map((r) => new Date(r.fechaHora ?? r.creadoEn).getTime());
        const desde = new Date(Math.min(...fechas));
        const hasta = new Date(Math.max(...fechas));
        periodoMostradoInicio = colombiaDayStartUTC(getColombiaDateString(desde));
        periodoMostradoFin = colombiaDayEndUTC(getColombiaDateString(hasta));
      } else {
        pendingRegistros = [];
      }
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
      periodoMostradoInicio,
      periodoMostradoFin,
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

    // Fixed comp: 100% MENSUAL, 50% QUINCENAL, 25% SEMANAL (same factor as LiquidarEmpleada)
    const factor =
      frecuenciaPago === 'QUINCENAL'
        ? FACTOR_FIJO_QUINCENAL
        : frecuenciaPago === 'SEMANAL'
          ? FACTOR_FIJO_SEMANAL
          : FACTOR_FIJO_MENSUAL;

    // Regla del dueño: el sueldo fijo SE ACUMULA por períodos vencidos sin
    // liquidar (como los sistemas de nómina estándar). Se toma la última
    // liquidación de la empleada (por fin de período) para contar cuántos
    // períodos pasaron sin pago. Sin historial → solo el vigente.
    const liquidacionesHistorial = await this.liquidacionRepo.findBySalonAndEmpleada(
      input.salonId,
      empleada.id,
    );
    let finUltimaLiquidacion: Date | null = null;
    if (liquidacionesHistorial.length > 0) {
      const ultima = liquidacionesHistorial.sort(
        (a, b) =>
          new Date(b.fechaHasta ?? b.creadoEn).getTime() -
          new Date(a.fechaHasta ?? a.creadoEn).getTime(),
      )[0];
      finUltimaLiquidacion = ultima.fechaHasta ?? ultima.creadoEn;
    }
    const periodosVencidosCalc = periodosVencidos(
      frecuenciaPago,
      finUltimaLiquidacion,
      getColombiaDateString(),
    );

    const bonoHorarioPeriodo = Number(empleada.bonoHorario) * factor * periodosVencidosCalc;
    const sueldoFijoPeriodo = Number(empleada.sueldoFijo) * factor * periodosVencidosCalc;

    result.push({
      empleadaId: empleada.id,
      nombre: empleada.nombre,
      totalComisionesPendientes,
      totalPropinas,
      bonoHorario: bonoHorarioPeriodo,
      sueldoFijo: sueldoFijoPeriodo,
      sueldoFijoMensual: Number(empleada.sueldoFijo),
      porcentajeComisionServicio: Number(empleada.porcentajeComisionServicio),
      totalAPagar:
        totalComisionesPendientes +
        totalPropinas +
        bonoHorarioPeriodo +
        sueldoFijoPeriodo,
      cantidadRegistros: pendingRegistros.length,
      periodoInicio: periodoMostradoInicio,
      periodoFin: periodoMostradoFin,
      frecuenciaPago,
    });
    }

    return result;
  }
}

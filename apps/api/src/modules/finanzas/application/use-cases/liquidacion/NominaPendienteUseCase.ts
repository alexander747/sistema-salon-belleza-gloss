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
 * Período COMPLETO de una fecha (inicio + fin NATURAL del período), a diferencia
 * de `calcularPeriodo` cuyo fin es "hoy" para MENSUAL. Se usa para enumerar
 * períodos vencidos históricos (ej. la fila de junio termina el 30/06, no hoy).
 */
export function calcularPeriodoCompleto(
  frecuenciaPago: FrecuenciaPago,
  fecha: string,
): { inicio: Date; fin: Date } {
  const [y, m] = fecha.split('-');

  if (frecuenciaPago === 'SEMANAL') {
    const ancla = new Date(`${fecha}T12:00:00Z`);
    const diasDesdeLunes = (ancla.getUTCDay() + 6) % 7;
    const lunes = addDays(fecha, -diasDesdeLunes);
    const domingo = addDays(fecha, 6 - diasDesdeLunes);
    return {
      inicio: colombiaDayStartUTC(lunes),
      fin: colombiaDayEndUTC(domingo),
    };
  }

  if (frecuenciaPago === 'QUINCENAL') {
    const dia = Number(fecha.slice(8, 10));
    if (dia <= 15) {
      return {
        inicio: colombiaDayStartUTC(`${y}-${m}-01`),
        fin: colombiaDayEndUTC(`${y}-${m}-15`),
      };
    }
    const ultimoDia = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
    return {
      inicio: colombiaDayStartUTC(`${y}-${m}-16`),
      fin: colombiaDayEndUTC(`${y}-${m}-${ultimoDia}`),
    };
  }

  const ultimoDia = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return {
    inicio: colombiaDayStartUTC(`${y}-${m}-01`),
    fin: colombiaDayEndUTC(`${y}-${m}-${ultimoDia}`),
  };
}

/**
 * Períodos de pago VENCIDOS sin liquidar, desde el fin de la última liquidación
 * hasta hoy (regla del dueño: el sueldo fijo se acumula por período, como en los
 * sistemas de nómina estándar). Devuelve la LISTA de períodos [{inicio, fin}]
 * para que la nómina muestre una fila por período (ej. junio, julio).
 *
 * - Sin liquidación previa → períodos de los registros pendientes (si los hay);
 *   si no hay registros → solo el período vigente.
 * - Con liquidación → períodos desde el fin de la última hasta hoy (inclusive).
 */
export function periodosVencidosLista(
  frecuenciaPago: FrecuenciaPago,
  finUltimaLiquidacion: Date | null,
  hoy: string,
  fechasRegistrosPendientes?: Array<Date | string>,
): Array<{ inicio: Date; fin: Date }> {
  const hoyDate = new Date(`${hoy}T12:00:00Z`);
  const fin = finUltimaLiquidacion ? new Date(finUltimaLiquidacion) : null;

  // Sin historial → los períodos de los registros pendientes (pueden ser de
  // semanas/meses anteriores sin liquidar); si no hay registros → el vigente.
  if (!fin) {
    if (fechasRegistrosPendientes && fechasRegistrosPendientes.length > 0) {
      const periodos = new Map<string, { inicio: Date; fin: Date }>();
      for (const f of fechasRegistrosPendientes) {
        const d = new Date(f);
        const fechaStr = getColombiaDateString(new Date(d.getTime() + 12 * 3_600_000));
        const p = calcularPeriodoCompleto(frecuenciaPago, fechaStr);
        const key = p.inicio.toISOString();
        if (!periodos.has(key)) {
          periodos.set(key, { inicio: p.inicio, fin: p.fin });
        }
      }
      // Ordenar cronológicamente
      return Array.from(periodos.values()).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    }
    const vigente = calcularPeriodo(frecuenciaPago, hoy);
    return [{ inicio: vigente.periodoInicio, fin: vigente.periodoFin }];
  }

  // Primer día del período siguiente al pagado (exclusivo del pagado)
  let cursor: Date;
  if (frecuenciaPago === 'SEMANAL' || frecuenciaPago === 'QUINCENAL') {
    cursor = new Date(fin.getTime() + 86_400_000);
  } else {
    cursor = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 1));
  }

  if (cursor > hoyDate) return [];

  const periodos: Array<{ inicio: Date; fin: Date }> = [];
  while (cursor <= hoyDate) {
    // Anclar a mediodía UTC para que la conversión a Colombia no retroceda al
    // día anterior (00:00 UTC − 5h = día previo en COT).
    const cursorAncla = new Date(cursor.getTime() + 12 * 3_600_000);
    const fechaCursor = getColombiaDateString(cursorAncla);
    // El período COMPLETO del cursor (no "hasta hoy"): para períodos vencidos
    // históricos el fin es el fin natural del período, no la fecha actual.
    const periodoCursor = calcularPeriodoCompleto(frecuenciaPago, fechaCursor);
    periodos.push({ inicio: periodoCursor.inicio, fin: periodoCursor.fin });
    if (frecuenciaPago === 'SEMANAL') {
      cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    } else if (frecuenciaPago === 'QUINCENAL') {
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
  return periodos;
}

/**
 * Períodos de pago VENCIDOS sin liquidar, contados desde el fin de la última
 * liquidación hasta hoy. Mantiene compatibilidad con el conteo simple.
 */
export function periodosVencidos(
  frecuenciaPago: FrecuenciaPago,
  finUltimaLiquidacion: Date | null,
  hoy: string,
): number {
  return periodosVencidosLista(frecuenciaPago, finUltimaLiquidacion, hoy).length || 1;
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

      const frecuenciaPago: FrecuenciaPago = empleada.frecuenciaPago ?? 'MENSUAL';

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

      // Última liquidación de la empleada → desde cuándo se debe
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

      // Lista de períodos vencidos (ej. junio, julio, agosto) — UNA FILA POR PERÍODO
      const periodos = periodosVencidosLista(
        frecuenciaPago,
        finUltimaLiquidacion,
        getColombiaDateString(),
        pendingRegistros.map((r) => r.fechaHora ?? r.creadoEn),
      );

      // Filtra registros ya cubiertos por una liquidación posterior (guard anti-doble-pago)
      if (finUltimaLiquidacion) {
        pendingRegistros = pendingRegistros.filter(
          (r) => new Date(r.creadoEn) > new Date(finUltimaLiquidacion),
        );
      }

      // Agrupar registros por período y emitir una fila por período
      for (const periodo of periodos) {
        const delPeriodo = pendingRegistros.filter((r) => {
          const fechaNegocio = new Date(r.fechaHora ?? r.creadoEn);
          return fechaNegocio >= periodo.inicio && fechaNegocio <= periodo.fin;
        });

        // Comp fijo PRORRATEADO POR DÍAS (estándar industria, divisor días del mes):
        // salario diario = mensual ÷ días del mes; el tramo paga salario diario × días
        // del tramo. Así el total mensual nunca varía y el tramo parcial (ej. 3 días
        // de una semana en mes de 31) paga lo justo, no un factor fijo inflado.
        const { diasTramo, diasMes } = diasDelPeriodo(periodo.inicio, periodo.fin);
        const bonoHorarioPeriodo =
          diasMes > 0 ? Math.round((Number(empleada.bonoHorario) * diasTramo) / diasMes) : 0;
        const sueldoFijoPeriodo =
          diasMes > 0 ? Math.round((Number(empleada.sueldoFijo) * diasTramo) / diasMes) : 0;
        const totalComisiones = delPeriodo.reduce((sum, r) => sum + Number(r.comisionCalculada), 0);
        const totalPropinas = delPeriodo.reduce((sum, r) => sum + Number(r.propina), 0);

        // Una fila solo si el período tiene algo liquidable: registros o comp fijo
        if (
          delPeriodo.length === 0 &&
          Number(empleada.sueldoFijo) <= 0 &&
          Number(empleada.bonoHorario) <= 0
        ) {
          continue;
        }

        result.push({
          empleadaId: empleada.id,
          nombre: empleada.nombre,
          totalComisionesPendientes: totalComisiones,
          totalPropinas,
          bonoHorario: bonoHorarioPeriodo,
          sueldoFijo: sueldoFijoPeriodo,
          sueldoFijoMensual: Number(empleada.sueldoFijo),
          porcentajeComisionServicio: Number(empleada.porcentajeComisionServicio),
          totalAPagar: totalComisiones + totalPropinas + bonoHorarioPeriodo + sueldoFijoPeriodo,
          cantidadRegistros: delPeriodo.length,
          periodoInicio: periodo.inicio,
          periodoFin: periodo.fin,
          frecuenciaPago,
        });
      }
    }

    return result;
  }
}

/**
 * Días del tramo (inicio→fin, bordes Colombia) y días del mes del tramo.
 * El fin es EXCLUSIVO (colombiaDayEndUTC = 05:00 UTC del día siguiente), por eso
 * la diferencia en ms / día = cantidad de días del tramo.
 */
function diasDelPeriodo(inicio: Date, fin: Date): { diasTramo: number; diasMes: number } {
  const MS_DIA = 86_400_000;
  const diasTramo = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / MS_DIA));
  const y = inicio.getUTCFullYear();
  const m = inicio.getUTCMonth(); // 0-based
  const diasMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { diasTramo, diasMes };
}

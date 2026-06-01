import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../domain/ports/ICitaRepository';
import type { IBloqueoAgendaRepository } from '../../domain/ports/IBloqueoAgendaRepository';
import type { IHorarioComercialRepository } from '../../domain/ports/IHorarioComercialRepository';
import { DisponibilidadResultDTO } from '../dtos/DisponibilidadResultDTO';

export interface TimeSlot {
  hora: string; // HH:MM
  disponible: boolean;
}

@injectable()
export class DisponibilidadService {
  constructor(
    @inject('IHorarioComercialRepository')
    private readonly horarioRepo: IHorarioComercialRepository,
    @inject('IBloqueoAgendaRepository')
    private readonly bloqueoRepo: IBloqueoAgendaRepository,
    @inject('ICitaRepository')
    private readonly citaRepo: ICitaRepository,
  ) {}

  /**
   * Verifica disponibilidad para un slot específico.
   *
   * Orden: Horario comercial → Bloqueos → Citas existentes (fail-fast).
   * La duración se calcula dinámicamente (no hardcoded 60 min — fix pos-ok bug).
   */
  async verificar(
    salonId: number,
    usuarioId: number,
    fechaInicio: Date,
    duracionMinutos: number,
  ): Promise<DisponibilidadResultDTO> {
    const fechaFin = new Date(fechaInicio.getTime() + duracionMinutos * 60000);

    // ── 1. Horario comercial ──────────────────────────
    const horario = await this.horarioRepo.findBySalonAndDia(salonId, fechaInicio.getDay());
    if (!horario || !horario.estaAbierto) {
      return new DisponibilidadResultDTO({
        disponible: false,
        motivo: 'Salón cerrado este día',
      });
    }

    const inicioMin = timeToMinutes(fechaInicio);
    const finMin = timeToMinutes(fechaFin);
    const aperturaMin = horario.horaApertura ? timeStrToMinutes(horario.horaApertura) : 0;
    const cierreMin = horario.horaCierre ? timeStrToMinutes(horario.horaCierre) : 1440;

    if (inicioMin < aperturaMin || finMin > cierreMin) {
      return new DisponibilidadResultDTO({
        disponible: false,
        motivo: 'Fuera del horario comercial',
      });
    }

    // ── 2. Bloqueos (employee + salon-wide) ──────────
    const bloqueos = await this.bloqueoRepo.findBySalonAndDateRange(salonId, fechaInicio, fechaFin);
    const bloqueoConflictivo = bloqueos.find((b) => {
      if (b.usuarioId !== null && b.usuarioId !== usuarioId) return false;
      return b.fechaInicio < fechaFin && b.fechaFin > fechaInicio;
    });

    if (bloqueoConflictivo) {
      return new DisponibilidadResultDTO({
        disponible: false,
        motivo: 'Bloqueo de agenda',
        fechaInicio: bloqueoConflictivo.fechaInicio.toISOString(),
        fechaFin: bloqueoConflictivo.fechaFin.toISOString(),
      });
    }

    // ── 3. Citas existentes (PENDIENTE|CONFIRMADA) ──
    // Buscamos citas activas del empleado para este día
    const diaStart = new Date(
      fechaInicio.getFullYear(),
      fechaInicio.getMonth(),
      fechaInicio.getDate(),
      0, 0, 0,
    );

    const citas = await this.citaRepo.findActiveByUsuario(usuarioId, diaStart);

    const overlap = citas.some((c) => {
      // Calcular duración real desde servicios (fix pos-ok bug)
      const duracion = (c.servicios ?? []).reduce((sum, s) => sum + s.duracionMinutos, 0);
      const citaFin = new Date(c.fechaHora.getTime() + duracion * 60000);
      return c.fechaHora < fechaFin && citaFin > fechaInicio;
    });

    if (overlap) {
      return new DisponibilidadResultDTO({
        disponible: false,
        motivo: 'Conflicto con cita existente',
      });
    }

    return new DisponibilidadResultDTO({ disponible: true });
  }

  /**
   * Genera slots de 30 minutos dentro del horario comercial,
   * filtrando los que tienen bloqueos o superposiciones con citas existentes.
   */
  async obtenerSlots(
    salonId: number,
    usuarioId: number,
    fecha: Date,
    duracionMinutos: number,
  ): Promise<TimeSlot[]> {
    const horario = await this.horarioRepo.findBySalonAndDia(salonId, fecha.getDay());
    if (!horario || !horario.estaAbierto || !horario.horaApertura || !horario.horaCierre) {
      return [];
    }

    const aperturaTotal = timeStrToMinutes(horario.horaApertura);
    const cierreTotal = timeStrToMinutes(horario.horaCierre);

    // Cargar datos del día completo
    const diaStart = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);
    const diaEnd = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59);

    const [citas, bloqueos] = await Promise.all([
      this.citaRepo.findActiveByUsuario(usuarioId, diaStart),
      this.bloqueoRepo.findBySalonAndDateRange(salonId, diaStart, diaEnd),
    ]);

    const slots: TimeSlot[] = [];

    for (let inicio = aperturaTotal; inicio + duracionMinutos <= cierreTotal; inicio += 30) {
      const hora = Math.floor(inicio / 60);
      const min = inicio % 60;
      const slotInicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hora, min);
      const slotFin = new Date(slotInicio.getTime() + duracionMinutos * 60000);

      const slotHora = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      // Check superposición con citas
      const citaOverlap = citas.some((c) => {
        const duracion = (c.servicios ?? []).reduce((sum, s) => sum + s.duracionMinutos, 0);
        const citaFin = new Date(c.fechaHora.getTime() + duracion * 60000);
        return c.fechaHora < slotFin && citaFin > slotInicio;
      });

      if (citaOverlap) {
        slots.push({ hora: slotHora, disponible: false });
        continue;
      }

      // Check superposición con bloqueos
      const bloqueoOverlap = bloqueos.some((b) => {
        if (b.usuarioId !== null && b.usuarioId !== usuarioId) return false;
        return b.fechaInicio < slotFin && b.fechaFin > slotInicio;
      });

      slots.push({
        hora: slotHora,
        disponible: !bloqueoOverlap,
      });
    }

    return slots;
  }
}

// ── Helpers ────────────────────────────────────────────

function timeToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function timeStrToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

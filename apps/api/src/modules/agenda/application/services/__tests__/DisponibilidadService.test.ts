import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { DisponibilidadService } from '../DisponibilidadService';

function makeMockHorario(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 1,
    diaSemana: 1, // Monday
    horaApertura: '09:00',
    horaCierre: '18:00',
    estaAbierto: true,
    ...overrides,
  };
}

function makeMockBloqueo(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    fechaInicio: new Date('2026-06-01T12:00:00'),
    fechaFin: new Date('2026-06-01T13:00:00'),
    tipo: 'PARCIAL',
    motivo: 'Almuerzo',
    ...overrides,
  };
}

function makeMockCita(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    fechaHora: new Date('2026-06-01T11:00:00'),
    estado: 'CONFIRMADA',
    notas: null,
    esWalkIn: false,
    servicios: [{ id: 1, nombre: 'Manicure', duracionMinutos: 60, precioBase: 1000 }],
    ...overrides,
  };
}

describe('DisponibilidadService', () => {
  function createService() {
    const horarioRepo = { findBySalonAndDia: vi.fn(), findBySalon: vi.fn() };
    const bloqueoRepo = { findBySalonAndDateRange: vi.fn(), findBySalon: vi.fn() };
    const citaRepo = { findActiveByUsuario: vi.fn(), findById: vi.fn() };

    const service = new DisponibilidadService(
      horarioRepo as any,
      bloqueoRepo as any,
      citaRepo as any,
    );

    return { service, horarioRepo, bloqueoRepo, citaRepo };
  }

  describe('verificar', () => {
    it('should return disponible when slot is available', async () => {
      const { service, horarioRepo, bloqueoRepo, citaRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([]);
      citaRepo.findActiveByUsuario.mockResolvedValue([]);

      const result = await service.verificar(
        1, 1, new Date('2026-06-01T10:00:00'), 60,
      );

      expect(result.disponible).toBe(true);
      expect(result.motivo).toBeUndefined();
    });

    it('should return not disponible when salon is closed (estaAbierto=false)', async () => {
      const { service, horarioRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(
        makeMockHorario({ estaAbierto: false }),
      );

      const result = await service.verificar(
        1, 1, new Date('2026-06-01T10:00:00'), 60,
      );

      expect(result.disponible).toBe(false);
      expect(result.motivo).toContain('cerrado');
    });

    it('should return not disponible when no horario exists for that day', async () => {
      const { service, horarioRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(null);

      const result = await service.verificar(
        1, 1, new Date('2026-06-01T10:00:00'), 60,
      );

      expect(result.disponible).toBe(false);
      expect(result.motivo).toContain('cerrado');
    });

    it('should return not disponible when slot is outside business hours', async () => {
      const { service, horarioRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());

      // 17:30 - 18:30, but cierre is 18:00
      const result = await service.verificar(
        1, 1, new Date('2026-06-01T17:30:00'), 60,
      );

      expect(result.disponible).toBe(false);
      expect(result.motivo).toContain('Fuera del horario');
    });

    it('should return not disponible when blocked by employee bloqueo', async () => {
      const { service, horarioRepo, bloqueoRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([
        makeMockBloqueo({ usuarioId: 1 }),
      ]);

      const result = await service.verificar(
        1, 1, new Date('2026-06-01T12:30:00'), 30,
      );

      expect(result.disponible).toBe(false);
      expect(result.motivo).toContain('Bloqueo');
    });

    it('should return not disponible when blocked by salon-wide bloqueo (usuarioId=null)', async () => {
      const { service, horarioRepo, bloqueoRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([
        makeMockBloqueo({ usuarioId: null }),
      ]);

      const result = await service.verificar(
        1, 2, new Date('2026-06-01T12:30:00'), 30,
      );

      expect(result.disponible).toBe(false);
      expect(result.motivo).toContain('Bloqueo');
    });

    it('should NOT block when bloqueo is for a different employee', async () => {
      const { service, horarioRepo, bloqueoRepo, citaRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([
        makeMockBloqueo({ usuarioId: 2 }),
      ]);
      citaRepo.findActiveByUsuario.mockResolvedValue([]);

      const result = await service.verificar(
        1, 1, new Date('2026-06-01T12:30:00'), 30,
      );

      expect(result.disponible).toBe(true);
    });

    it('should return not disponible when overlapping with existing cita', async () => {
      const { service, horarioRepo, bloqueoRepo, citaRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([]);
      citaRepo.findActiveByUsuario.mockResolvedValue([
        makeMockCita({ fechaHora: new Date('2026-06-01T10:00:00') }),
      ]);

      // 10:30 - 11:30 overlaps with 10:00 - 11:00 cita
      const result = await service.verificar(
        1, 1, new Date('2026-06-01T10:30:00'), 60,
      );

      expect(result.disponible).toBe(false);
      expect(result.motivo).toContain('Conflicto');
    });
  });

  describe('obtenerSlots', () => {
    it('should return slots for full business hours when no conflicts', async () => {
      const { service, horarioRepo, bloqueoRepo, citaRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      citaRepo.findActiveByUsuario.mockResolvedValue([]);
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([]);

      const fecha = new Date('2026-06-01T00:00:00');
      const result = await service.obtenerSlots(1, 1, fecha, 60);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual({ hora: '09:00', disponible: true });
      expect(result[result.length - 1]).toEqual({ hora: '17:00', disponible: true });
    });

    it('should mark slots as non-disponible when blocked by cita', async () => {
      const { service, horarioRepo, bloqueoRepo, citaRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(makeMockHorario());
      citaRepo.findActiveByUsuario.mockResolvedValue([
        makeMockCita({ fechaHora: new Date('2026-06-01T10:00:00') }),
      ]);
      bloqueoRepo.findBySalonAndDateRange.mockResolvedValue([]);

      const fecha = new Date('2026-06-01T00:00:00');
      const result = await service.obtenerSlots(1, 1, fecha, 60);

      // 10:00 slot should be not disponible (10:00-11:00 cita)
      const slot10 = result.find((s) => s.hora === '10:00');
      expect(slot10?.disponible).toBe(false);
      // 11:00 slot should be available
      const slot11 = result.find((s) => s.hora === '11:00');
      expect(slot11?.disponible).toBe(true);
    });

    it('should return empty array when salon is closed', async () => {
      const { service, horarioRepo } = createService();
      horarioRepo.findBySalonAndDia.mockResolvedValue(
        makeMockHorario({ estaAbierto: false }),
      );

      const fecha = new Date('2026-06-01T00:00:00');
      const result = await service.obtenerSlots(1, 1, fecha, 60);

      expect(result).toEqual([]);
    });
  });
});

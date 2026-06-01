import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

// Mock entity module to prevent TypeORM decorator evaluation
vi.mock('../../../../infrastructure/persistence/entities/CitaEntity.js', () => ({
  EstadoCita: {
    PENDIENTE: 'PENDIENTE',
    CONFIRMADA: 'CONFIRMADA',
    COMPLETADA: 'COMPLETADA',
    CANCELADA: 'CANCELADA',
    NO_LLEGO: 'NO_LLEGO',
  },
}));

import { validarTransicion, cambiarEstado, ESTADO_TRANSICIONES_VALIDAS } from '../state-machine';
import { EstadoCita } from '../../../../infrastructure/persistence/entities/CitaEntity';

function makeCita(estado: EstadoCita) {
  return { estado } as any;
}

describe('state-machine', () => {
  describe('validarTransicion', () => {
    // ── Valid transitions ──────────────────────────────────────
    it.each([
      [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA],
      [EstadoCita.PENDIENTE, EstadoCita.CANCELADA],
      [EstadoCita.CONFIRMADA, EstadoCita.COMPLETADA],
      [EstadoCita.CONFIRMADA, EstadoCita.NO_LLEGO],
      [EstadoCita.CONFIRMADA, EstadoCita.CANCELADA],
    ])('should allow %s → %s', (actual, nuevo) => {
      expect(validarTransicion(actual, nuevo)).toBe(true);
    });

    // ── Invalid transitions ────────────────────────────────────
    it.each([
      [EstadoCita.PENDIENTE, EstadoCita.COMPLETADA],
      [EstadoCita.PENDIENTE, EstadoCita.NO_LLEGO],
      [EstadoCita.CONFIRMADA, EstadoCita.PENDIENTE],
      [EstadoCita.COMPLETADA, EstadoCita.PENDIENTE],
      [EstadoCita.COMPLETADA, EstadoCita.CONFIRMADA],
      [EstadoCita.COMPLETADA, EstadoCita.CANCELADA],
      [EstadoCita.COMPLETADA, EstadoCita.NO_LLEGO],
      [EstadoCita.CANCELADA, EstadoCita.PENDIENTE],
      [EstadoCita.CANCELADA, EstadoCita.CONFIRMADA],
      [EstadoCita.CANCELADA, EstadoCita.COMPLETADA],
      [EstadoCita.CANCELADA, EstadoCita.NO_LLEGO],
      [EstadoCita.NO_LLEGO, EstadoCita.PENDIENTE],
      [EstadoCita.NO_LLEGO, EstadoCita.CONFIRMADA],
      [EstadoCita.NO_LLEGO, EstadoCita.COMPLETADA],
      [EstadoCita.NO_LLEGO, EstadoCita.CANCELADA],
    ])('should reject %s → %s', (actual, nuevo) => {
      expect(validarTransicion(actual, nuevo)).toBe(false);
    });
  });

  describe('cambiarEstado', () => {
    it('should mutate cita.estado for valid transition', () => {
      const cita = makeCita(EstadoCita.PENDIENTE);
      cambiarEstado(cita, EstadoCita.CONFIRMADA);
      expect(cita.estado).toBe(EstadoCita.CONFIRMADA);
    });

    it('should throw for invalid transition', () => {
      const cita = makeCita(EstadoCita.COMPLETADA);
      expect(() => cambiarEstado(cita, EstadoCita.CONFIRMADA)).toThrow('Transición inválida');
    });

    it('should throw when transitioning from terminal state', () => {
      const cita = makeCita(EstadoCita.CANCELADA);
      expect(() => cambiarEstado(cita, EstadoCita.PENDIENTE)).toThrow('Transición inválida');
    });
  });

  describe('ESTADO_TRANSICIONES_VALIDAS', () => {
    it('should have empty arrays for terminal states', () => {
      expect(ESTADO_TRANSICIONES_VALIDAS[EstadoCita.COMPLETADA]).toEqual([]);
      expect(ESTADO_TRANSICIONES_VALIDAS[EstadoCita.CANCELADA]).toEqual([]);
      expect(ESTADO_TRANSICIONES_VALIDAS[EstadoCita.NO_LLEGO]).toEqual([]);
    });
  });
});

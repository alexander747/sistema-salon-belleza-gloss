import { describe, it, expect } from 'vitest';
import { getCitaActions } from './citaActions';

describe('getCitaActions — gating de botones del modal de detalle', () => {
  it('PENDIENTE → solo Confirmar y Cancelar (NUNCA Completar)', () => {
    expect(getCitaActions('PENDIENTE')).toEqual(['CONFIRMAR', 'CANCELAR']);
  });

  it('CONFIRMADA → Completar, No Llegó y Cancelar (todo lo que el state-machine permite)', () => {
    expect(getCitaActions('CONFIRMADA')).toEqual(['COMPLETAR', 'NO_LLEGO', 'CANCELAR']);
  });

  it('COMPLETADA → sin acciones (estado terminal)', () => {
    expect(getCitaActions('COMPLETADA')).toEqual([]);
  });

  it('CANCELADA → sin acciones (estado terminal)', () => {
    expect(getCitaActions('CANCELADA')).toEqual([]);
  });

  it('NO_LLEGO → sin acciones (estado terminal)', () => {
    expect(getCitaActions('NO_LLEGO')).toEqual([]);
  });

  it('EN_PROGRESO (legacy del frontend, no existe en backend) → sin acciones', () => {
    expect(getCitaActions('EN_PROGRESO')).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { formatCurrency, formatTimeAMPM } from './format';

/** es-CO currency usa NBSP entre símbolo y número — normalizar para comparar. */
function normalize(s: string): string {
  return s.replace(/\u00a0/g, ' ');
}

describe('formatCurrency', () => {
  it('formatea montos COP con separador de miles (es-CO)', () => {
    expect(normalize(formatCurrency(50000))).toBe('$ 50.000');
  });

  it('formatea montos de 7 dígitos', () => {
    expect(normalize(formatCurrency(1200000))).toBe('$ 1.200.000');
  });

  it('formatea cero', () => {
    expect(normalize(formatCurrency(0))).toBe('$ 0');
  });

  it('devuelve $0 para null', () => {
    expect(formatCurrency(null)).toBe('$0');
  });

  it('devuelve $0 para undefined', () => {
    expect(formatCurrency(undefined)).toBe('$0');
  });

  it('no usa decimales (COP entero) — trunca la fracción', () => {
    expect(normalize(formatCurrency(50000.4))).toBe('$ 50.000');
  });
});

describe('formatTimeAMPM', () => {
  it('convierte medianoche "00:00" a "12:00 AM"', () => {
    expect(formatTimeAMPM('00:00')).toBe('12:00 AM');
  });

  it('convierte mediodía "12:00" a "12:00 PM"', () => {
    expect(formatTimeAMPM('12:00')).toBe('12:00 PM');
  });

  it('convierte la tarde con ceros a la izquierda "13:05" a "01:05 PM"', () => {
    expect(formatTimeAMPM('13:05')).toBe('01:05 PM');
  });

  it('convierte la mañana "08:00" a "08:00 AM"', () => {
    expect(formatTimeAMPM('08:00')).toBe('08:00 AM');
  });

  it('convierte la tarde "14:30" a "02:30 PM"', () => {
    expect(formatTimeAMPM('14:30')).toBe('02:30 PM');
  });

  it('devuelve la entrada sin cambios ante texto vacío', () => {
    expect(formatTimeAMPM('')).toBe('');
  });

  it('devuelve la entrada sin cambios ante texto inválido sin lanzar', () => {
    expect(formatTimeAMPM('abc')).toBe('abc');
  });

  it('devuelve la entrada sin cambios ante una fecha ISO completa', () => {
    expect(formatTimeAMPM('2026-01-01T10:00:00')).toBe('2026-01-01T10:00:00');
  });
});

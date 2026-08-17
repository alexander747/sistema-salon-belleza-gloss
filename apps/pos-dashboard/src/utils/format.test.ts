import { describe, it, expect } from 'vitest';
import { formatCurrency } from './format';

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

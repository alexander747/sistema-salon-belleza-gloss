import { describe, it, expect } from 'vitest';
import { formatMoneyDigits, computeMoneyCaret } from './moneyInput';

describe('formatMoneyDigits', () => {
  it('agrupa miles con punto (es-CO)', () => {
    expect(formatMoneyDigits('50000')).toBe('50.000');
  });

  it('agrupa millones', () => {
    expect(formatMoneyDigits('1200000')).toBe('1.200.000');
  });

  it('mantiene dígitos cortos sin separador', () => {
    expect(formatMoneyDigits('999')).toBe('999');
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(formatMoneyDigits('')).toBe('');
  });

  it('ignora ceros a la izquierda', () => {
    expect(formatMoneyDigits('000123')).toBe('123');
  });
});

describe('computeMoneyCaret', () => {
  it('caret al inicio cuando no hay dígitos previos', () => {
    expect(computeMoneyCaret('50.000', 0)).toBe(0);
  });

  it('caret tras un dígito (antes de cualquier separador)', () => {
    expect(computeMoneyCaret('50.000', 1)).toBe(1);
  });

  it('caret tras dos dígitos queda antes del separador', () => {
    // "50|.000" — el separador recién aparece en el índice 2, después del caret
    expect(computeMoneyCaret('50.000', 2)).toBe(2);
  });

  it('caret al final del string cuando se escriben todos los dígitos', () => {
    expect(computeMoneyCaret('50.000', 5)).toBe(6);
  });

  it('caret dentro de un grupo intermedio respeta separadores previos', () => {
    // "1.200.000", 4 dígitos antes del caret → "1.200|.000" → índice 5
    expect(computeMoneyCaret('1.200.000', 4)).toBe(5);
  });

  it('caret al final cuando digitIndex excede los dígitos', () => {
    expect(computeMoneyCaret('1.200', 9)).toBe(5);
  });
});

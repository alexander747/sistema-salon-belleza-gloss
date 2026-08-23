import { describe, it, expect } from 'vitest';
import { calcularPendiente } from './fiado.js';

describe('calcularPendiente — deuda restante tras pago parcial o fiado', () => {
  it('fiado total: sin pago, queda el total completo (propina 0)', () => {
    expect(calcularPendiente(100000, 0, 0)).toBe(100000);
  });

  it('pago parcial: resta el monto cobrado', () => {
    expect(calcularPendiente(90000, 0, 50000)).toBe(40000);
  });

  it('pago parcial con propina: la propina queda fuera de la deuda (decisión owner D8)', () => {
    expect(calcularPendiente(90000, 10000, 80000)).toBe(0);
  });

  it('piso 0: nunca devuelve deuda negativa (sobrepago o pago que cubre todo)', () => {
    expect(calcularPendiente(50000, 0, 60000)).toBe(0);
    expect(calcularPendiente(30000, 10000, 30000)).toBe(0);
  });
});

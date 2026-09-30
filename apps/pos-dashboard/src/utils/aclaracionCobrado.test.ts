import { describe, it, expect } from 'vitest';
import { formatCurrency } from './format.js';
import { buildAclaracionCobrado } from './aclaracionCobrado.js';

/**
 * PR6 — Línea condicional que explica la diferencia Cobrado − Ingresos.
 * El texto se deriva SOLO de campos expuestos por el resumen (valores enteros)
 * y NUNCA fabrica un monto para el residual (el resumen no expone abonos/deuda previa).
 */
describe('buildAclaracionCobrado', () => {
  it('gap === 0 → sin línea (devengado == cobrado)', () => {
    expect(
      buildAclaracionCobrado({ totalIngresos: 935000, totalCobrado: 935000, totalPropinas: 5000 }),
    ).toBeNull();
  });

  it('gap === totalPropinas (> 0) → nombra el monto exacto de propinas', () => {
    const texto = buildAclaracionCobrado({
      totalIngresos: 935000,
      totalCobrado: 940000,
      totalPropinas: 5000,
    });
    expect(texto).toContain(formatCurrency(5000));
    expect(texto).toMatch(/propinas/i);
    // No describe residual genérico cuando el gap son SOLO propinas
    expect(texto).not.toMatch(/abonos de deudas anteriores/i);
  });

  it('gap > totalPropinas → propinas exactas + residual genérico, SIN monto fabricado', () => {
    const texto = buildAclaracionCobrado({
      totalIngresos: 935000,
      totalCobrado: 955000,
      totalPropinas: 5000,
    });
    expect(texto).toContain(formatCurrency(5000));
    expect(texto).toMatch(/abonos de deudas anteriores/i);
    // El residual (15000) no es un campo del API → no debe aparecer fabricado
    expect(texto).not.toContain(formatCurrency(15000));
  });

  it('gap > 0 con totalPropinas === 0 → genérico sin cláusula de propinas', () => {
    const texto = buildAclaracionCobrado({
      totalIngresos: 935000,
      totalCobrado: 950000,
      totalPropinas: 0,
    });
    expect(texto).toMatch(/abonos de deudas anteriores/i);
    expect(texto).not.toMatch(/propinas/i);
  });

  it('gap < 0 (Cobrado < Ingresos) → fiado genérico, sin montos fabricados', () => {
    const texto = buildAclaracionCobrado({
      totalIngresos: 935000,
      totalCobrado: 930000,
      totalPropinas: 0,
    });
    expect(texto).toMatch(/aún no se cobró \(fiado\)/i);
    expect(texto).not.toMatch(/\$/);
  });

  it('gap positivo pero MENOR que propinas → cae a genérico sin fabricar montos', () => {
    const texto = buildAclaracionCobrado({
      totalIngresos: 935000,
      totalCobrado: 937000,
      totalPropinas: 5000,
    });
    expect(texto).not.toContain(formatCurrency(5000));
    expect(texto).toMatch(/abonos de deudas anteriores/i);
  });

  it('redondea los valores del API a enteros antes de comparar', () => {
    // 939999.6 → 940000; 934999.6 → 935000; gap 5000 → propinas exactas
    const texto = buildAclaracionCobrado({
      totalIngresos: 934999.6,
      totalCobrado: 939999.6,
      totalPropinas: 5000,
    });
    expect(texto).toContain(formatCurrency(5000));
    expect(texto).not.toMatch(/abonos de deudas anteriores/i);
  });

  it('campos ausentes/undefined → se tratan como 0 y no renderizan línea', () => {
    expect(buildAclaracionCobrado({})).toBeNull();
    expect(buildAclaracionCobrado({ totalIngresos: undefined, totalCobrado: undefined })).toBeNull();
  });
});

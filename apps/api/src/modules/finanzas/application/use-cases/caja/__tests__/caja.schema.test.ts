import { describe, it, expect } from 'vitest';
import { abrirCajaSchema, cerrarCajaSchema } from '@pos-final/validation';

describe('abrirCajaSchema', () => {
  it('should accept montoInicial válido (incluye 0)', () => {
    const result = abrirCajaSchema.parse({ montoInicial: 50000 });
    expect(result.montoInicial).toBe(50000);
    expect(abrirCajaSchema.parse({ montoInicial: 0 }).montoInicial).toBe(0);
  });

  it('should reject montoInicial ausente', () => {
    expect(() => abrirCajaSchema.parse({})).toThrow();
  });

  it('should reject montoInicial negativo', () => {
    expect(() => abrirCajaSchema.parse({ montoInicial: -1 })).toThrow();
  });
});

describe('cerrarCajaSchema', () => {
  it('should accept montoRealEfectivo válido', () => {
    const result = cerrarCajaSchema.parse({ montoRealEfectivo: 160000 });
    expect(result.montoRealEfectivo).toBe(160000);
  });

  it('should reject montoRealEfectivo ausente', () => {
    expect(() => cerrarCajaSchema.parse({})).toThrow();
  });

  it('should reject montoRealEfectivo negativo', () => {
    expect(() => cerrarCajaSchema.parse({ montoRealEfectivo: -5 })).toThrow();
  });

  it('should accept cajaId opcional (entero positivo) y preservarlo', () => {
    const result = cerrarCajaSchema.parse({ montoRealEfectivo: 160000, cajaId: 9 });
    expect(result.cajaId).toBe(9);
  });

  it('should aceptar sin cajaId (fallback a la caja de hoy)', () => {
    const result = cerrarCajaSchema.parse({ montoRealEfectivo: 160000 });
    expect(result.cajaId).toBeUndefined();
  });

  it('should rechazar cajaId no positivo (0 y negativos)', () => {
    expect(() => cerrarCajaSchema.parse({ montoRealEfectivo: 160000, cajaId: 0 })).toThrow();
    expect(() => cerrarCajaSchema.parse({ montoRealEfectivo: 160000, cajaId: -3 })).toThrow();
  });

  it('should rechazar cajaId no entero', () => {
    expect(() => cerrarCajaSchema.parse({ montoRealEfectivo: 160000, cajaId: 1.5 })).toThrow();
  });
});

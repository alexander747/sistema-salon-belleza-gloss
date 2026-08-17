import { describe, it, expect } from 'vitest';
import { createEmpleadaSchema, updateEmpleadaSchema } from '@pos-final/validation';
import { Rol } from '@pos-final/types';

describe('personas.schema — frecuenciaPago', () => {
  const baseValid = {
    nombre: 'Ana',
    numeroWhatsApp: '3128553060',
    email: 'ana@test.com',
    password: 'secret123',
    rol: Rol.MANICURISTA,
  };

  it('defaults frecuenciaPago to MENSUAL when the field is absent (create)', () => {
    const result = createEmpleadaSchema.parse(baseValid);
    expect(result.frecuenciaPago).toBe('MENSUAL');
  });

  it('accepts frecuenciaPago QUINCENAL on create', () => {
    const result = createEmpleadaSchema.parse({
      ...baseValid,
      frecuenciaPago: 'QUINCENAL',
    });
    expect(result.frecuenciaPago).toBe('QUINCENAL');
  });

  it('accepts frecuenciaPago SEMANAL on create', () => {
    const result = createEmpleadaSchema.parse({
      ...baseValid,
      frecuenciaPago: 'SEMANAL',
    });
    expect(result.frecuenciaPago).toBe('SEMANAL');
  });

  it('rejects an invalid frecuenciaPago value (ANUAL) on create', () => {
    expect(() =>
      createEmpleadaSchema.parse({ ...baseValid, frecuenciaPago: 'ANUAL' }),
    ).toThrow();
  });

  it('accepts frecuenciaPago QUINCENAL and SEMANAL on update and rejects invalid values', () => {
    const result = updateEmpleadaSchema.parse({ frecuenciaPago: 'QUINCENAL' });
    expect(result.frecuenciaPago).toBe('QUINCENAL');

    const resultSemanal = updateEmpleadaSchema.parse({ frecuenciaPago: 'SEMANAL' });
    expect(resultSemanal.frecuenciaPago).toBe('SEMANAL');

    expect(() => updateEmpleadaSchema.parse({ frecuenciaPago: 'ANUAL' })).toThrow();
  });
});

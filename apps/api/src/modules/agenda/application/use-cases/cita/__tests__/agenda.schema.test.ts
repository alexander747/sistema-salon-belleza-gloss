import { describe, it, expect } from 'vitest';
import { createCitaSchema } from '@pos-final/validation';

const base = {
  clienteId: 1,
  usuarioId: 2,
  fechaHora: '2026-06-01T10:00:00.000Z',
};

describe('agenda.schema — createCitaSchema cantidad por servicio', () => {
  it('acepta servicios: [{servicioId, cantidad}] y preserva la cantidad', () => {
    const result = createCitaSchema.parse({
      ...base,
      servicios: [{ servicioId: 7, cantidad: 2 }],
    });

    expect(result.servicios).toEqual([{ servicioId: 7, cantidad: 2 }]);
  });

  it('default cantidad=1 cuando la línea no la envía', () => {
    const result = createCitaSchema.parse({
      ...base,
      servicios: [{ servicioId: 7 }],
    });

    expect(result.servicios?.[0]).toEqual({ servicioId: 7, cantidad: 1 });
  });

  it('rechaza cantidad=0 (int ≥ 1)', () => {
    expect(() =>
      createCitaSchema.parse({
        ...base,
        servicios: [{ servicioId: 7, cantidad: 0 }],
      }),
    ).toThrow();
  });

  it('rechaza cantidad negativa', () => {
    expect(() =>
      createCitaSchema.parse({
        ...base,
        servicios: [{ servicioId: 7, cantidad: -3 }],
      }),
    ).toThrow();
  });

  it('legacy: sigue aceptando serviciosIds', () => {
    const result = createCitaSchema.parse({ ...base, serviciosIds: [1, 2] });

    expect(result.serviciosIds).toEqual([1, 2]);
  });

  it('rechaza cuando no hay ni servicios ni serviciosIds', () => {
    expect(() => createCitaSchema.parse({ ...base })).toThrow();
  });

  it('rechaza servicios vacío sin serviciosIds', () => {
    expect(() => createCitaSchema.parse({ ...base, servicios: [] })).toThrow();
  });
});

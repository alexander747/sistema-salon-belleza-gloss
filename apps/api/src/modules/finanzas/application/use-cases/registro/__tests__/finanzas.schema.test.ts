import { describe, it, expect } from 'vitest';
import { createRegistroSchema, completarCitaSchema } from '@pos-final/validation';

describe('createRegistroSchema — serviciosItems', () => {
  const baseValid = {
    salonId: 1,
    clienteId: 1,
    usuarioId: 1,
    totalServicios: 50000,
    totalProductos: 0,
    propina: 0,
    pagos: [{ monto: 50000, metodoPago: 'EFECTIVO' }],
  };

  it('should default serviciosItems to [] when field is absent', () => {
    const result = createRegistroSchema.parse(baseValid);
    expect(result.serviciosItems).toEqual([]);
  });

  it('should accept valid serviciosItems array', () => {
    const payload = {
      ...baseValid,
      serviciosItems: [
        { servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000 },
        { servicioId: 2, nombreServicio: 'Tintura', precioServicio: 60000 },
      ],
    };
    const result = createRegistroSchema.parse(payload);
    expect(result.serviciosItems).toHaveLength(2);
    expect(result.serviciosItems[0]).toEqual({
      servicioId: 1,
      nombreServicio: 'Corte',
      precioServicio: 25000,
    });
    expect(result.serviciosItems[1]).toEqual({
      servicioId: 2,
      nombreServicio: 'Tintura',
      precioServicio: 60000,
    });
  });

  it('should reject serviciosItems with servicioId = 0', () => {
    const payload = {
      ...baseValid,
      serviciosItems: [
        { servicioId: 0, nombreServicio: 'Test', precioServicio: 10000 },
      ],
    };
    expect(() => createRegistroSchema.parse(payload)).toThrow();
  });

  it('should reject serviciosItems with empty nombreServicio', () => {
    const payload = {
      ...baseValid,
      serviciosItems: [
        { servicioId: 1, nombreServicio: '', precioServicio: 10000 },
      ],
    };
    expect(() => createRegistroSchema.parse(payload)).toThrow();
  });

  it('should reject serviciosItems with negative precioServicio', () => {
    const payload = {
      ...baseValid,
      serviciosItems: [
        { servicioId: 1, nombreServicio: 'Corte', precioServicio: -1 },
      ],
    };
    expect(() => createRegistroSchema.parse(payload)).toThrow();
  });
});

describe('completarCitaSchema', () => {
  const validRegistro = {
    salonId: 1,
    clienteId: 1,
    usuarioId: 2,
    totalServicios: 50000,
    totalProductos: 0,
    propina: 0,
    pagos: [{ monto: 50000, metodoPago: 'EFECTIVO' }],
    serviciosItems: [{ servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000 }],
  };

  it('should accept a valid registro payload', () => {
    const result = completarCitaSchema.parse({ registro: validRegistro });
    expect(result.registro?.clienteId).toBe(1);
    expect(result.registro?.serviciosItems).toHaveLength(1);
  });

  it('should accept an empty body (registro optional — legacy path)', () => {
    const result = completarCitaSchema.parse({});
    expect(result.registro).toBeUndefined();
  });

  it('should accept body without registro key', () => {
    const result = completarCitaSchema.parse({ salonId: 1 });
    // Las claves desconocidas se descartan y registro queda undefined
    expect(result.registro).toBeUndefined();
  });

  it('should reject a registro missing required fields', () => {
    const bad = { registro: { salonId: 1, totalServicios: 0 } };
    expect(() => completarCitaSchema.parse(bad)).toThrow();
  });

  it('should reject a registro with negative payment', () => {
    const bad = {
      registro: {
        ...validRegistro,
        pagos: [{ monto: -5, metodoPago: 'EFECTIVO' }],
      },
    };
    expect(() => completarCitaSchema.parse(bad)).toThrow();
  });
});

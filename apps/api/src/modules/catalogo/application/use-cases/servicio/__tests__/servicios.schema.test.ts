import { describe, it, expect } from 'vitest';
import { createServicioSchema, updateServicioSchema } from '@pos-final/validation';

const base = {
  nombre: 'Tinte',
  precioBase: 45000,
  duracionMinutos: 60,
  categoriaId: 1,
};

describe('catalogo.schema — servicio tipoCostoInsumo / precioPorGramo', () => {
  it('create: acepta POR_GRAMO con precioPorGramo positivo y lo devuelve', () => {
    const result = createServicioSchema.parse({
      ...base,
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: 1200,
    });

    expect(result.tipoCostoInsumo).toBe('POR_GRAMO');
    expect(result.precioPorGramo).toBe(1200);
  });

  it('create: POR_GRAMO sin precioPorGramo es rechazado', () => {
    expect(() =>
      createServicioSchema.parse({ ...base, tipoCostoInsumo: 'POR_GRAMO' }),
    ).toThrow();
  });

  it('create: POR_GRAMO con precioPorGramo=0 es rechazado', () => {
    expect(() =>
      createServicioSchema.parse({
        ...base,
        tipoCostoInsumo: 'POR_GRAMO',
        precioPorGramo: 0,
      }),
    ).toThrow();
  });

  it('create: sin tipoCostoInsumo default FIJO y precioPorGramo nulo', () => {
    const result = createServicioSchema.parse({ ...base });

    expect(result.tipoCostoInsumo).toBe('FIJO');
    expect(result.precioPorGramo ?? null).toBeNull();
  });

  it('update partial: sigue parseando y acepta los nuevos campos', () => {
    const partial = updateServicioSchema.parse({ precioBase: 150 });
    expect(partial.precioBase).toBe(150);

    const gramos = updateServicioSchema.parse({
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: 1500,
    });
    expect(gramos.tipoCostoInsumo).toBe('POR_GRAMO');
    expect(gramos.precioPorGramo).toBe(1500);
  });

  it('update partial: rechaza precioPorGramo no positivo por forma', () => {
    expect(() => updateServicioSchema.parse({ precioPorGramo: 0 })).toThrow();
    expect(() => updateServicioSchema.parse({ precioPorGramo: -5 })).toThrow();
  });
});

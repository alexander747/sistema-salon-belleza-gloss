import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { ProductoEntity, TipoPrecio } from '../ProductoEntity';

describe('ProductoEntity — tipoPrecio', () => {
  it('exposes FIJO and MARGEN enum values', () => {
    expect(TipoPrecio.FIJO).toBe('FIJO');
    expect(TipoPrecio.MARGEN).toBe('MARGEN');
  });

  it('maps a tipoPrecio column that defaults to MARGEN', () => {
    const column = getMetadataArgsStorage().columns.find(
      (c) => c.target === ProductoEntity && c.propertyName === 'tipoPrecio',
    );

    expect(column?.options.default).toBe('MARGEN');
    expect(column?.options.length).toBe(10);
  });
});

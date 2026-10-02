import { describe, it, expect } from 'vitest';
import {
  createProductoSchema,
  updateProductoSchema,
  restockProductoSchema,
} from '@pos-final/validation';

const longCode = '7'.repeat(51);

describe('catalogo.schema — producto codigoBarras', () => {
  it('accepts codigoBarras on create and returns it', () => {
    const result = createProductoSchema.parse({
      nombre: 'Shampoo',
      codigoBarras: '7701234567890',
    });

    expect(result.codigoBarras).toBe('7701234567890');
  });

  it('accepts codigoBarras null on create (producto sin código)', () => {
    const result = createProductoSchema.parse({
      nombre: 'Shampoo',
      codigoBarras: null,
    });

    expect(result.codigoBarras).toBeNull();
  });

  it('rejects codigoBarras longer than 50 chars on create', () => {
    expect(() =>
      createProductoSchema.parse({ nombre: 'Shampoo', codigoBarras: longCode }),
    ).toThrow();
  });

  it('update partial: accepts codigoBarras value, null and rejects >50 chars', () => {
    expect(updateProductoSchema.parse({ codigoBarras: '7701234567890' }).codigoBarras).toBe('7701234567890');
    expect(updateProductoSchema.parse({ codigoBarras: null }).codigoBarras).toBeNull();
    expect(() => updateProductoSchema.parse({ codigoBarras: longCode })).toThrow();
  });
});

describe('catalogo.schema — producto tipoPrecio', () => {
  it('defaults tipoPrecio to MARGEN on create', () => {
    const result = createProductoSchema.parse({ nombre: 'Shampoo' });

    expect(result.tipoPrecio).toBe('MARGEN');
  });

  it('create accepts FIJO with an explicit positive price', () => {
    const result = createProductoSchema.parse({
      nombre: 'Shampoo',
      tipoPrecio: 'FIJO',
      precioVenta: 500,
    });

    expect(result.tipoPrecio).toBe('FIJO');
    expect(result.precioVenta).toBe(500);
  });

  it('create rejects FIJO without precioVenta', () => {
    expect(() =>
      createProductoSchema.parse({ nombre: 'Shampoo', tipoPrecio: 'FIJO' }),
    ).toThrow();
  });

  it('create rejects FIJO with precioVenta 0', () => {
    expect(() =>
      createProductoSchema.parse({ nombre: 'Shampoo', tipoPrecio: 'FIJO', precioVenta: 0 }),
    ).toThrow();
  });

  it('create rejects an unknown tipoPrecio', () => {
    expect(() =>
      createProductoSchema.parse({ nombre: 'Shampoo', tipoPrecio: 'OTRO' }),
    ).toThrow();
  });

  it('update partial: accepts tipoPrecio and precioVenta without other fields', () => {
    const result = updateProductoSchema.parse({ tipoPrecio: 'FIJO', precioVenta: 750 });

    expect(result.tipoPrecio).toBe('FIJO');
    expect(result.precioVenta).toBe(750);
  });
});

describe('catalogo.schema — restock precioVenta', () => {
  it('accepts restock without an explicit precioVenta', () => {
    const result = restockProductoSchema.parse({ cantidad: 5, precioCompra: 100 });

    expect(result.precioVenta).toBeUndefined();
  });

  it('accepts an explicit precioVenta for FIJO mode', () => {
    const result = restockProductoSchema.parse({ cantidad: 5, precioCompra: 100, precioVenta: 650 });

    expect(result.precioVenta).toBe(650);
  });

  it('rejects a non-positive precioVenta', () => {
    expect(() =>
      restockProductoSchema.parse({ cantidad: 5, precioCompra: 100, precioVenta: 0 }),
    ).toThrow();
  });
});

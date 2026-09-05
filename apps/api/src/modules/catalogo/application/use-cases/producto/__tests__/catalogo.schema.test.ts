import { describe, it, expect } from 'vitest';
import { createProductoSchema, updateProductoSchema } from '@pos-final/validation';

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

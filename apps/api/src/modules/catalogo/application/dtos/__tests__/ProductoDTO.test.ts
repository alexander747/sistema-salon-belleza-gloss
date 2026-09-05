import { describe, it, expect } from 'vitest';
import { ProductoDTO } from '../ProductoDTO';
import type { ProductoEntity } from '../../../../../infrastructure/persistence/entities/ProductoEntity';

const makeEntity = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    nombre: 'Shampoo Profesional',
    marca: 'Loreal',
    color: null,
    tamano: null,
    descripcion: null,
    urlFoto: null,
    codigoBarras: null,
    precioCompra: 20000,
    precioVenta: 26000,
    margenGanancia: 30,
    cantidadStock: 15,
    stockMinimo: 5,
    tipoInventario: 'RETAIL',
    activo: true,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  }) as unknown as ProductoEntity;

describe('ProductoDTO.fromEntity — codigoBarras', () => {
  it('maps codigoBarras null to null', () => {
    const dto = ProductoDTO.fromEntity(makeEntity({ codigoBarras: null }));

    expect(dto.codigoBarras).toBeNull();
  });

  it('maps a barcode value to the DTO', () => {
    const dto = ProductoDTO.fromEntity(makeEntity({ codigoBarras: '7701234567890' }));

    expect(dto.codigoBarras).toBe('7701234567890');
  });
});

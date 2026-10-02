import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ReabastecerStockUseCase } from '../ReabastecerStockUseCase';
import { NotFoundError } from '../../../../../../shared/errors';
import type { IProductoRepository } from '../../../../domain/ports/IProductoRepository';

const makeProducto = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  nombre: 'Esmalte',
  marca: null,
  codigoBarras: null,
  color: null,
  tamano: null,
  descripcion: null,
  urlFoto: null,
  precioCompra: 0,
  precioVenta: 500,
  margenGanancia: 30,
  tipoPrecio: 'FIJO',
  cantidadStock: 10,
  stockMinimo: 1,
  tipoInventario: 'RETAIL',
  activo: true,
  salonId: 1,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  ...overrides,
});

const setup = (producto: Record<string, unknown>, updated: Record<string, unknown>) => {
  const incrementStock = vi.fn().mockResolvedValue(updated);
  const productoRepo = {
    findBySalonAndId: vi.fn().mockResolvedValue(producto),
    incrementStock,
  } as unknown as IProductoRepository;
  return { useCase: new ReabastecerStockUseCase(productoRepo), incrementStock };
};

describe('ReabastecerStockUseCase — precioVenta untouched', () => {
  it('increments stock + cost and keeps the configured precioVenta (never forwards a sale price)', async () => {
    const producto = makeProducto({ cantidadStock: 10, precioCompra: 0, precioVenta: 500 });
    const { useCase, incrementStock } = setup(
      producto,
      makeProducto({ cantidadStock: 15, precioCompra: 90, precioVenta: 500 }),
    );

    const result = await useCase.execute({ salonId: 1, id: 5, cantidad: 5, precioCompra: 90 });

    // Delegation contract: only (id, cantidad, precioCompra) — there is no price slot.
    expect(incrementStock).toHaveBeenCalledWith(5, 5, 90);
    expect(result.cantidadStock).toBe(15);
    expect(result.precioVenta).toBe(500);
    expect(result.tipoPrecio).toBe('FIJO');
  });

  it('keeps precioVenta when no cost is provided (triangulation, different price)', async () => {
    const producto = makeProducto({ cantidadStock: 2, precioCompra: 40, precioVenta: 750 });
    const { useCase, incrementStock } = setup(
      producto,
      makeProducto({ cantidadStock: 4, precioCompra: 40, precioVenta: 750 }),
    );

    const result = await useCase.execute({ salonId: 1, id: 5, cantidad: 2 });

    expect(incrementStock).toHaveBeenCalledWith(5, 2, undefined);
    expect(result.cantidadStock).toBe(4);
    expect(result.precioVenta).toBe(750);
  });

  it('throws NotFoundError when the producto does not exist and does not touch stock', async () => {
    const incrementStock = vi.fn();
    const productoRepo = {
      findBySalonAndId: vi.fn().mockResolvedValue(null),
      incrementStock,
    } as unknown as IProductoRepository;

    const useCase = new ReabastecerStockUseCase(productoRepo);

    await expect(
      useCase.execute({ salonId: 1, id: 999, cantidad: 5 }),
    ).rejects.toThrow(NotFoundError);
    expect(incrementStock).not.toHaveBeenCalled();
  });
});

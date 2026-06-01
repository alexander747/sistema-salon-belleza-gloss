import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { DescontarStockUseCase } from '../DescontarStockUseCase';
import type { IProductoRepository } from '../../../../domain/ports/IProductoRepository';
import { UnprocessableEntityError, NotFoundError } from '../../../../../../shared/errors';

describe('DescontarStockUseCase', () => {
  const createMocks = () => ({
    productoRepo: {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      decrementStock: vi.fn(),
      incrementStock: vi.fn(),
    } as unknown as IProductoRepository,
  });

  const makeProducto = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    nombre: 'Esmalte Rojo',
    marca: null,
    color: null,
    tamano: null,
    descripcion: null,
    urlFoto: null,
    precioCompra: 50,
    precioVenta: 150,
    cantidadStock: 10,
    stockMinimo: 2,
    tipoInventario: 'RETAIL',
    activo: true,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  });

  it('should decrement stock when sufficient stock available', async () => {
    const mocks = createMocks();
    const producto = makeProducto({ cantidadStock: 10 });
    mocks.productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(producto);
    mocks.productoRepo.decrementStock = vi.fn().mockResolvedValue({
      ...producto,
      cantidadStock: 7,
    });

    const useCase = new DescontarStockUseCase(mocks.productoRepo);
    const result = await useCase.execute({ salonId: 1, id: 1, cantidad: 3 });

    expect(result.cantidadStock).toBe(7);
    expect(mocks.productoRepo.decrementStock).toHaveBeenCalledWith(1, 3);
  });

  it('should throw UnprocessableEntityError when stock is insufficient', async () => {
    const mocks = createMocks();
    const producto = makeProducto({ cantidadStock: 2 });
    mocks.productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(producto);

    const useCase = new DescontarStockUseCase(mocks.productoRepo);

    await expect(
      useCase.execute({ salonId: 1, id: 1, cantidad: 5 }),
    ).rejects.toThrow(UnprocessableEntityError);

    expect(mocks.productoRepo.decrementStock).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when producto does not exist', async () => {
    const mocks = createMocks();
    mocks.productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(null);

    const useCase = new DescontarStockUseCase(mocks.productoRepo);

    await expect(
      useCase.execute({ salonId: 1, id: 999, cantidad: 1 }),
    ).rejects.toThrow(NotFoundError);
  });
});

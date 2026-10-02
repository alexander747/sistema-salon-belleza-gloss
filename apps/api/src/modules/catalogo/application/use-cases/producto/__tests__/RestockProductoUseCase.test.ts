import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateQueryRunner } = vi.hoisted(() => ({
  mockCreateQueryRunner: vi.fn(),
}));

vi.mock('../../../../../../shared/database', () => ({
  AppDataSource: { createQueryRunner: mockCreateQueryRunner },
}));

import { RestockProductoUseCase } from '../RestockProductoUseCase';
import type { IProductoRepository } from '../../../../domain/ports/IProductoRepository';

describe('RestockProductoUseCase — tipoPrecio', () => {
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

  const createMocks = (producto: Record<string, unknown>) => {
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    mockCreateQueryRunner.mockReturnValue(queryRunner);

    const productoRepo = {
      findBySalonAndId: vi.fn().mockResolvedValue(producto),
      restock: vi.fn().mockResolvedValue(producto),
    } as unknown as IProductoRepository;

    return { productoRepo, queryRunner };
  };

  beforeEach(() => {
    mockCreateQueryRunner.mockReset();
  });

  it('keeps a FIJO price while updating the weighted-average cost', async () => {
    const producto = makeProducto({ tipoPrecio: 'FIJO', precioVenta: 500, precioCompra: 0, cantidadStock: 10 });
    const { productoRepo, queryRunner } = createMocks(producto);

    const useCase = new RestockProductoUseCase(productoRepo);
    const result = await useCase.execute({ salonId: 1, id: 5, cantidad: 5, precioCompra: 100 });

    expect(productoRepo.restock).toHaveBeenCalledWith(
      expect.objectContaining({
        nuevoPrecioCompra: 33.33,
        nuevoPrecioVenta: 500,
        precioVenta: 500,
        stockDespues: 15,
      }),
      queryRunner,
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.precioVenta).toBe(500);
  });

  it('recomputes a MARGEN price from the new PMP', async () => {
    const producto = makeProducto({ tipoPrecio: 'MARGEN', precioVenta: 0, precioCompra: 0, cantidadStock: 0, margenGanancia: 30 });
    const { productoRepo } = createMocks(producto);

    const useCase = new RestockProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, id: 5, cantidad: 10, precioCompra: 100 });

    expect(productoRepo.restock).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoPrecioCompra: 100, nuevoPrecioVenta: 130 }),
      expect.anything(),
    );
  });

  it('honors an explicit price on a FIJO restock', async () => {
    const producto = makeProducto({ tipoPrecio: 'FIJO', precioVenta: 500 });
    const { productoRepo } = createMocks(producto);

    const useCase = new RestockProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, id: 5, cantidad: 5, precioCompra: 100, precioVenta: 650 });

    expect(productoRepo.restock).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoPrecioVenta: 650, precioVenta: 650 }),
      expect.anything(),
    );
  });

  it('ignores an explicit price on a MARGEN restock (recompute wins)', async () => {
    const producto = makeProducto({ tipoPrecio: 'MARGEN', precioVenta: 0, precioCompra: 0, cantidadStock: 0, margenGanancia: 30 });
    const { productoRepo } = createMocks(producto);

    const useCase = new RestockProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, id: 5, cantidad: 10, precioCompra: 100, precioVenta: 999 });

    expect(productoRepo.restock).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoPrecioVenta: 130 }),
      expect.anything(),
    );
  });
});

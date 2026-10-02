import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { CreateProductoUseCase } from '../CreateProductoUseCase';
import type { IProductoRepository } from '../../../../domain/ports/IProductoRepository';
import { ConflictError } from '../../../../../../shared/errors';
import { TipoPrecio } from '../../../../../../infrastructure/persistence/entities/ProductoEntity';

describe('CreateProductoUseCase — codigoBarras', () => {
  const createMocks = () => {
    const productoRepo = {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      findByCodigoBarras: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      decrementStock: vi.fn(),
      incrementStock: vi.fn(),
      restock: vi.fn(),
      findHistorial: vi.fn(),
    } as unknown as IProductoRepository;
    return { productoRepo };
  };

  const makeProducto = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    nombre: 'Shampoo Profesional',
    marca: null,
    codigoBarras: null,
    color: null,
    tamano: null,
    descripcion: null,
    urlFoto: null,
    precioCompra: 20000,
    precioVenta: 26000,
    margenGanancia: 30,
    tipoPrecio: 'MARGEN',
    cantidadStock: 15,
    stockMinimo: 5,
    tipoInventario: 'RETAIL',
    activo: true,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  });

  const baseInput = {
    salonId: 1,
    nombre: 'Shampoo Profesional',
  };

  it('persists codigoBarras when provided', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findByCodigoBarras = vi.fn().mockResolvedValue(null);
    productoRepo.create = vi.fn().mockResolvedValue(makeProducto({ codigoBarras: '7701234567890' }));

    const useCase = new CreateProductoUseCase(productoRepo);
    const result = await useCase.execute({ ...baseInput, codigoBarras: '7701234567890' });

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ codigoBarras: '7701234567890', salonId: 1 }),
    );
    expect(result.codigoBarras).toBe('7701234567890');
  });

  it('normalizes an empty codigoBarras to null before persisting', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findByCodigoBarras = vi.fn().mockResolvedValue(null);
    productoRepo.create = vi.fn().mockResolvedValue(makeProducto());

    const useCase = new CreateProductoUseCase(productoRepo);
    await useCase.execute({ ...baseInput, codigoBarras: '' });

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ codigoBarras: null }),
    );
    expect(productoRepo.findByCodigoBarras).not.toHaveBeenCalled();
  });

  it('throws ConflictError when another active product in the salon has the same barcode', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findByCodigoBarras = vi.fn().mockResolvedValue(makeProducto({ id: 9 }));

    const useCase = new CreateProductoUseCase(productoRepo);

    await expect(
      useCase.execute({ ...baseInput, codigoBarras: '7701234567890' }),
    ).rejects.toThrow(ConflictError);
    expect(productoRepo.create).not.toHaveBeenCalled();
  });

  it('does not check uniqueness when codigoBarras is absent', async () => {
    const { productoRepo } = createMocks();
    productoRepo.create = vi.fn().mockResolvedValue(makeProducto());

    const useCase = new CreateProductoUseCase(productoRepo);
    await useCase.execute(baseInput);

    expect(productoRepo.findByCodigoBarras).not.toHaveBeenCalled();
  });
});

describe('CreateProductoUseCase — tipoPrecio', () => {
  const createMocks = () => {
    const productoRepo = {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      findByCodigoBarras: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      decrementStock: vi.fn(),
      incrementStock: vi.fn(),
      restock: vi.fn(),
      findHistorial: vi.fn(),
    } as unknown as IProductoRepository;
    return { productoRepo };
  };

  const makeProducto = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    nombre: 'Shampoo',
    marca: null,
    codigoBarras: null,
    color: null,
    tamano: null,
    descripcion: null,
    urlFoto: null,
    precioCompra: 100,
    precioVenta: 130,
    margenGanancia: 30,
    tipoPrecio: 'MARGEN',
    cantidadStock: 0,
    stockMinimo: 0,
    tipoInventario: 'RETAIL',
    activo: true,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  });

  it('stores a FIJO price verbatim and persists the mode', async () => {
    const { productoRepo } = createMocks();
    productoRepo.create = vi.fn().mockResolvedValue(
      makeProducto({ tipoPrecio: 'FIJO', precioVenta: 500 }),
    );

    const useCase = new CreateProductoUseCase(productoRepo);
    const result = await useCase.execute({
      salonId: 1,
      nombre: 'Shampoo',
      tipoPrecio: TipoPrecio.FIJO,
      precioVenta: 500,
      precioCompra: 100,
      margenGanancia: 30,
    });

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoPrecio: 'FIJO', precioVenta: 500 }),
    );
    expect(result.tipoPrecio).toBe('FIJO');
    expect(result.precioVenta).toBe(500);
  });

  it('derives precioVenta from margin in MARGEN mode when absent', async () => {
    const { productoRepo } = createMocks();
    productoRepo.create = vi.fn().mockResolvedValue(makeProducto());

    const useCase = new CreateProductoUseCase(productoRepo);
    await useCase.execute({
      salonId: 1,
      nombre: 'Shampoo',
      tipoPrecio: TipoPrecio.MARGEN,
      precioCompra: 100,
      margenGanancia: 30,
    });

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoPrecio: 'MARGEN', precioVenta: 130 }),
    );
  });

  it('defaults to MARGEN when the mode is omitted', async () => {
    const { productoRepo } = createMocks();
    productoRepo.create = vi.fn().mockResolvedValue(makeProducto({ precioVenta: 0 }));

    const useCase = new CreateProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, nombre: 'Shampoo' });

    expect(productoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoPrecio: 'MARGEN', precioVenta: 0 }),
    );
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { UpdateProductoUseCase } from '../UpdateProductoUseCase';
import type { IProductoRepository } from '../../../../domain/ports/IProductoRepository';
import { ConflictError } from '../../../../../../shared/errors';

describe('UpdateProductoUseCase — codigoBarras', () => {
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
    cantidadStock: 15,
    stockMinimo: 5,
    tipoInventario: 'RETAIL',
    activo: true,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  });

  const baseProducto = makeProducto();

  it('persists codigoBarras when provided on update', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(baseProducto);
    productoRepo.findByCodigoBarras = vi.fn().mockResolvedValue(null);
    productoRepo.update = vi.fn().mockResolvedValue(makeProducto({ codigoBarras: '7701234567890' }));

    const useCase = new UpdateProductoUseCase(productoRepo);
    const result = await useCase.execute({ salonId: 1, id: 1, codigoBarras: '7701234567890' });

    expect(productoRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ codigoBarras: '7701234567890' }));
    expect(result.codigoBarras).toBe('7701234567890');
  });

  it('normalizes an empty codigoBarras to null (borra el código)', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(baseProducto);
    productoRepo.update = vi.fn().mockResolvedValue(baseProducto);

    const useCase = new UpdateProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, id: 1, codigoBarras: '' });

    expect(productoRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ codigoBarras: null }));
    expect(productoRepo.findByCodigoBarras).not.toHaveBeenCalled();
  });

  it('clears codigoBarras when an explicit null is sent', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(makeProducto({ codigoBarras: '7701234567890' }));
    productoRepo.update = vi.fn().mockResolvedValue(makeProducto());

    const useCase = new UpdateProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, id: 1, codigoBarras: null });

    expect(productoRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ codigoBarras: null }));
    expect(productoRepo.findByCodigoBarras).not.toHaveBeenCalled();
  });

  it('does not touch codigoBarras when the field is not sent', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(baseProducto);
    productoRepo.update = vi.fn().mockResolvedValue(baseProducto);

    const useCase = new UpdateProductoUseCase(productoRepo);
    await useCase.execute({ salonId: 1, id: 1, nombre: 'Shampoo Premium' });

    expect(productoRepo.update).toHaveBeenCalledWith(1, expect.not.objectContaining({ codigoBarras: expect.anything() }));
    expect(productoRepo.findByCodigoBarras).not.toHaveBeenCalled();
  });

  it('throws ConflictError when another active product uses the barcode', async () => {
    const { productoRepo } = createMocks();
    productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(baseProducto);
    productoRepo.findByCodigoBarras = vi.fn().mockResolvedValue(makeProducto({ id: 9, codigoBarras: '7701234567890' }));

    const useCase = new UpdateProductoUseCase(productoRepo);

    await expect(
      useCase.execute({ salonId: 1, id: 1, codigoBarras: '7701234567890' }),
    ).rejects.toThrow(ConflictError);
    expect(productoRepo.update).not.toHaveBeenCalled();
  });

  it('allows keeping the same barcode on the same product (self excluded)', async () => {
    const { productoRepo } = createMocks();
    const conMismoCodigo = makeProducto({ codigoBarras: '7701234567890' });
    productoRepo.findBySalonAndId = vi.fn().mockResolvedValue(conMismoCodigo);
    // La búsqueda por código encuentra el MISMO producto (id 1)
    productoRepo.findByCodigoBarras = vi.fn().mockResolvedValue(conMismoCodigo);
    productoRepo.update = vi.fn().mockResolvedValue(conMismoCodigo);

    const useCase = new UpdateProductoUseCase(productoRepo);
    const result = await useCase.execute({ salonId: 1, id: 1, codigoBarras: '7701234567890' });

    expect(productoRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ codigoBarras: '7701234567890' }));
    expect(result.codigoBarras).toBe('7701234567890');
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetRepository } = vi.hoisted(() => ({ mockGetRepository: vi.fn() }));

vi.mock('../../../../../shared/database', () => ({
  AppDataSource: { getRepository: mockGetRepository },
}));

import { TypeORMProductoRepository } from '../TypeORMProductoRepository';

/**
 * `ReabastecerStockUseCase` only delegates to `incrementStock`. The real
 * invariant lives here: the repository persists stock + (optional) cost and
 * MUST leave `precioVenta` untouched — `/restock` owns price derivation.
 */
function setup(producto: Record<string, unknown>) {
  const fakeRepo = {
    findOneBy: vi.fn().mockResolvedValue(producto),
    save: vi.fn(async (p: unknown) => p),
  };
  mockGetRepository.mockReturnValue(fakeRepo);
  return { repo: new TypeORMProductoRepository(), fakeRepo };
}

describe('TypeORMProductoRepository.incrementStock — precioVenta invariant', () => {
  beforeEach(() => {
    mockGetRepository.mockReset();
  });

  it('persists cantidadStock + precioCompra and never overwrites precioVenta', async () => {
    const { repo, fakeRepo } = setup({
      id: 5,
      cantidadStock: 10,
      precioCompra: 0,
      precioVenta: 500,
      tipoPrecio: 'FIJO',
    });

    const result = await repo.incrementStock(5, 5, 90);

    expect(fakeRepo.save).toHaveBeenCalledTimes(1);
    const saved = fakeRepo.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.cantidadStock).toBe(15);
    expect(saved.precioCompra).toBe(90);
    expect(saved.precioVenta).toBe(500);
    expect(result?.precioVenta).toBe(500);
  });

  it('leaves precioCompra untouched when no cost is given, still keeping precioVenta (triangulation)', async () => {
    const { repo, fakeRepo } = setup({
      id: 5,
      cantidadStock: 2,
      precioCompra: 40,
      precioVenta: 750,
      tipoPrecio: 'MARGEN',
    });

    const result = await repo.incrementStock(5, 3);

    const saved = fakeRepo.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.cantidadStock).toBe(5);
    expect(saved.precioCompra).toBe(40);
    expect(saved.precioVenta).toBe(750);
    expect(result?.precioVenta).toBe(750);
  });

  it('returns null for a missing producto without saving', async () => {
    const { repo, fakeRepo } = setup({});
    fakeRepo.findOneBy.mockResolvedValue(null);

    const result = await repo.incrementStock(999, 5, 90);

    expect(result).toBeNull();
    expect(fakeRepo.save).not.toHaveBeenCalled();
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListRegistrosUseCase } from '../ListRegistrosUseCase';

// Fix de paginación (PR5): el total paginado (`meta.total`) y las filas deben
// derivar del MISMO criterio. El use case reenvía `estado`/`tipo` a `search` y
// `count`; si divergieran, el total no coincidiría con las filas servidas.
describe('ListRegistrosUseCase — paginación server-side por estado/tipo', () => {
  let useCase: ListRegistrosUseCase;
  let repo: { search: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repo = {
      search: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    useCase = new ListRegistrosUseCase(repo as never);
  });

  it('reenvía estado y tipo idénticos a search Y count', async () => {
    repo.count.mockResolvedValue(15);

    const result = await useCase.execute({
      salonId: 1,
      page: 1,
      limit: 12,
      estado: 'ACTIVOS',
      tipo: 'SERVICIOS',
    });

    expect(repo.search).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'ACTIVOS', tipo: 'SERVICIOS' }),
    );
    expect(repo.count).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'ACTIVOS', tipo: 'SERVICIOS' }),
    );
    expect(result.meta.total).toBe(15);
  });

  it('sin estado/tipo usa TODOS en ambos (compatibilidad hacia atrás)', async () => {
    await useCase.execute({ salonId: 1, page: 1, limit: 12 });

    expect(repo.search).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'TODOS', tipo: 'TODOS' }),
    );
    expect(repo.count).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'TODOS', tipo: 'TODOS' }),
    );
  });

  it('meta.total ignora el recorte de página (count es el total del filtro)', async () => {
    repo.count.mockResolvedValue(26);
    repo.search.mockResolvedValue([{ id: 1 }]);

    const result = await useCase.execute({
      salonId: 1,
      page: 3,
      limit: 12,
      estado: 'TODOS',
      tipo: 'TODOS',
    });

    expect(result.meta.total).toBe(26);
    expect(result.meta.totalPages).toBe(3);
    expect(repo.search).toHaveBeenCalledWith(expect.objectContaining({ skip: 24, take: 12 }));
  });
});

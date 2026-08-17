import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDefaultRepoUpdate = vi.fn();
const mockDefaultFindOne = vi.fn();
const mockQrUpdate = vi.fn();
const mockQrFindOne = vi.fn();

vi.mock('../../../../../shared/database', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({
      update: mockDefaultRepoUpdate,
      findOne: mockDefaultFindOne,
      create: vi.fn(),
      save: vi.fn(),
    })),
  },
}));

import { TypeORMCitaRepository } from '../TypeORMCitaRepository';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';

describe('TypeORMCitaRepository.cambiarEstado', () => {
  let repo: TypeORMCitaRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new TypeORMCitaRepository();
  });

  it('should update via the default repository when no queryRunner is passed', async () => {
    mockDefaultRepoUpdate.mockResolvedValue(undefined);
    mockDefaultFindOne.mockResolvedValue({ id: 1, estado: 'COMPLETADA' });

    const result = await repo.cambiarEstado(1, EstadoCita.COMPLETADA, { completadoPorId: 2 });

    expect(mockDefaultRepoUpdate).toHaveBeenCalledWith(1, {
      estado: 'COMPLETADA',
      completadoPorId: 2,
    });
    expect(result?.estado).toBe('COMPLETADA');
    expect(mockQrUpdate).not.toHaveBeenCalled();
  });

  it('should update through the shared queryRunner when one is passed (no default repo)', async () => {
    const qr = {
      manager: {
        getRepository: vi.fn(() => ({ update: mockQrUpdate })),
        findOne: mockQrFindOne,
      },
    };
    mockQrUpdate.mockResolvedValue(undefined);
    mockQrFindOne.mockResolvedValue({ id: 1, estado: 'COMPLETADA' });

    await repo.cambiarEstado(1, EstadoCita.COMPLETADA, { completadoPorId: 2 }, qr as never);

    expect(qr.manager.getRepository).toHaveBeenCalled();
    expect(mockQrUpdate).toHaveBeenCalledWith(1, {
      estado: 'COMPLETADA',
      completadoPorId: 2,
    });
    expect(mockDefaultRepoUpdate).not.toHaveBeenCalled();
    expect(mockQrFindOne).toHaveBeenCalled();
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ListCategoriasUseCase } from '../ListCategoriasUseCase';
import type { ICategoriaServicioRepository } from '../../../../domain/ports/ICategoriaServicioRepository';

describe('ListCategoriasUseCase', () => {
  const createMocks = () => ({
    categoriaRepo: {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      findByNameAndSalon: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      countActiveServicios: vi.fn(),
    } as unknown as ICategoriaServicioRepository,
  });

  it('should return all active categorias for a salon', async () => {
    const mocks = createMocks();
    const mockCategorias = [
      { id: 1, nombre: 'Uñas', descripcion: null, emoji: null, orden: 0, activo: true, salonId: 1, creadoEn: new Date(), actualizadoEn: new Date() },
      { id: 2, nombre: 'Pestañas', descripcion: null, emoji: null, orden: 1, activo: true, salonId: 1, creadoEn: new Date(), actualizadoEn: new Date() },
    ];
    mocks.categoriaRepo.findBySalon = vi.fn().mockResolvedValue(mockCategorias);

    const useCase = new ListCategoriasUseCase(mocks.categoriaRepo);
    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].nombre).toBe('Uñas');
    expect(result[1].nombre).toBe('Pestañas');
    expect(mocks.categoriaRepo.findBySalon).toHaveBeenCalledWith(1);
  });

  it('should return empty array when no categorias exist', async () => {
    const mocks = createMocks();
    mocks.categoriaRepo.findBySalon = vi.fn().mockResolvedValue([]);

    const useCase = new ListCategoriasUseCase(mocks.categoriaRepo);
    const result = await useCase.execute({ salonId: 999 });

    expect(result).toHaveLength(0);
  });
});

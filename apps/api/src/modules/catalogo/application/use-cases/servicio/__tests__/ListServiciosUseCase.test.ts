import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ListServiciosUseCase } from '../ListServiciosUseCase';
import type { IServicioRepository } from '../../../../domain/ports/IServicioRepository';
import type { ISalonRepository } from '../../../../../../modules/salon/domain/ports/ISalonRepository';

describe('ListServiciosUseCase', () => {
  const createMocks = () => ({
    servicioRepo: {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      countFotos: vi.fn(),
    } as unknown as IServicioRepository,
    salonRepo: {
      findById: vi.fn(),
      findAll: vi.fn(),
    } as unknown as ISalonRepository,
  });

  it('should return servicios with precioFinal when seasonal pricing is active', async () => {
    const mocks = createMocks();
    const mockServicios = [
      { id: 1, nombre: 'Manicure', precioBase: 1000, duracionMinutos: 60, activo: true, categoriaId: 1, salonId: 1, creadoEn: new Date(), actualizadoEn: new Date() },
    ];
    const mockSalon = {
      id: 1,
      reglasTemporada: {
        fechaInicio: '2020-01-01',
        fechaFin: '2030-12-31',
        multiplicador: 1.5,
      },
    };

    mocks.servicioRepo.findBySalon = vi.fn().mockResolvedValue(mockServicios);
    mocks.salonRepo.findById = vi.fn().mockResolvedValue(mockSalon);

    const useCase = new ListServiciosUseCase(mocks.servicioRepo, mocks.salonRepo);
    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].precioFinal).toBe(1500);
    expect(result[0].nombre).toBe('Manicure');
  });

  it('should use base precio when no seasonal pricing', async () => {
    const mocks = createMocks();
    const mockServicios = [
      { id: 1, nombre: 'Manicure', precioBase: 1000, duracionMinutos: 60, activo: true, categoriaId: 1, salonId: 1, creadoEn: new Date(), actualizadoEn: new Date() },
    ];

    mocks.servicioRepo.findBySalon = vi.fn().mockResolvedValue(mockServicios);
    mocks.salonRepo.findById = vi.fn().mockResolvedValue({ id: 1 });

    const useCase = new ListServiciosUseCase(mocks.servicioRepo, mocks.salonRepo);
    const result = await useCase.execute({ salonId: 1 });

    expect(result[0].precioFinal).toBe(1000);
  });

  it('should filter by categoriaId when provided', async () => {
    const mocks = createMocks();
    mocks.servicioRepo.findBySalon = vi.fn().mockResolvedValue([]);
    mocks.salonRepo.findById = vi.fn().mockResolvedValue({ id: 1 });

    const useCase = new ListServiciosUseCase(mocks.servicioRepo, mocks.salonRepo);
    await useCase.execute({ salonId: 1, categoriaId: 3 });

    expect(mocks.servicioRepo.findBySalon).toHaveBeenCalledWith(1, 3);
  });
});

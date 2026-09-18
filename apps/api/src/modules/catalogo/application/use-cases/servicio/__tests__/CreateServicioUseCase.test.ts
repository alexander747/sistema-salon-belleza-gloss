import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { CreateServicioUseCase } from '../CreateServicioUseCase';
import type { IServicioRepository } from '../../../../domain/ports/IServicioRepository';
import type { ICategoriaServicioRepository } from '../../../../domain/ports/ICategoriaServicioRepository';
import type { ISalonRepository } from '../../../../../../modules/salon/domain/ports/ISalonRepository';
import type { ServicioEntity } from '../../../../../../infrastructure/persistence/entities/ServicioEntity';

function build() {
  const servicioRepo = {
    findBySalon: vi.fn(),
    findBySalonAndId: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    countFotos: vi.fn(),
  } as unknown as IServicioRepository;

  const categoriaRepo = {
    findBySalonAndId: vi.fn().mockResolvedValue({ id: 1 }),
  } as unknown as ICategoriaServicioRepository;

  const salonRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn(),
  } as unknown as ISalonRepository;

  (servicioRepo.create as ReturnType<typeof vi.fn>).mockImplementation(
    (data: Partial<ServicioEntity>) =>
      Promise.resolve({
        id: 1,
        ...data,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      } as ServicioEntity),
  );

  const useCase = new CreateServicioUseCase(servicioRepo, categoriaRepo, salonRepo);
  return { useCase, servicioRepo };
}

const baseInput = {
  salonId: 1,
  nombre: 'Tinte',
  precioBase: 45000,
  duracionMinutos: 60,
  categoriaId: 1,
};

describe('CreateServicioUseCase — modo de costo', () => {
  it('persiste POR_GRAMO con su precioPorGramo y lo expone en el DTO', async () => {
    const { useCase, servicioRepo } = build();

    const dto = await useCase.execute({
      ...baseInput,
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: 1200,
    });

    expect(servicioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoCostoInsumo: 'POR_GRAMO', precioPorGramo: 1200 }),
    );
    expect(dto.tipoCostoInsumo).toBe('POR_GRAMO');
    expect(dto.precioPorGramo).toBe(1200);
  });

  it('sin modo explícito persiste FIJO con precioPorGramo null', async () => {
    const { useCase, servicioRepo } = build();

    const dto = await useCase.execute({ ...baseInput });

    expect(servicioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoCostoInsumo: 'FIJO', precioPorGramo: null }),
    );
    expect(dto.tipoCostoInsumo).toBe('FIJO');
    expect(dto.precioPorGramo).toBeNull();
  });

  it('FIJO ignora un precioPorGramo enviado por el cliente', async () => {
    const { useCase, servicioRepo } = build();

    const dto = await useCase.execute({
      ...baseInput,
      tipoCostoInsumo: 'FIJO',
      precioPorGramo: 9999,
    });

    expect(servicioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipoCostoInsumo: 'FIJO', precioPorGramo: null }),
    );
    expect(dto.precioPorGramo).toBeNull();
  });
});

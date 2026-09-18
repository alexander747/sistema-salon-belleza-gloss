import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { UpdateServicioUseCase } from '../UpdateServicioUseCase';
import { UnprocessableEntityError } from '../../../../../../shared/errors';
import type { IServicioRepository } from '../../../../domain/ports/IServicioRepository';
import type { ICategoriaServicioRepository } from '../../../../domain/ports/ICategoriaServicioRepository';
import type { ISalonRepository } from '../../../../../../modules/salon/domain/ports/ISalonRepository';
import type { ServicioEntity } from '../../../../../../infrastructure/persistence/entities/ServicioEntity';

const existing = {
  id: 10,
  nombre: 'Tinte',
  precioBase: 45000,
  duracionMinutos: 60,
  categoriaId: 1,
  costoBaseInsumos: 0,
  tipoCostoInsumo: 'FIJO',
  precioPorGramo: null,
  activo: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
} as unknown as ServicioEntity;

function build(servicio: ServicioEntity = existing) {
  const servicioRepo = {
    findBySalon: vi.fn(),
    findBySalonAndId: vi.fn().mockResolvedValue(servicio),
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockImplementation((_id: number, data: Partial<ServicioEntity>) =>
      Promise.resolve({ ...servicio, ...data } as ServicioEntity),
    ),
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

  const useCase = new UpdateServicioUseCase(servicioRepo, categoriaRepo, salonRepo);
  return { useCase, servicioRepo };
}

describe('UpdateServicioUseCase — modo de costo', () => {
  it('cambia a POR_GRAMO con precio y lo persiste', async () => {
    const { useCase, servicioRepo } = build();

    const dto = await useCase.execute({
      salonId: 1,
      id: 10,
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: 1500,
    });

    expect(servicioRepo.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ tipoCostoInsumo: 'POR_GRAMO', precioPorGramo: 1500 }),
    );
    expect(dto.tipoCostoInsumo).toBe('POR_GRAMO');
    expect(dto.precioPorGramo).toBe(1500);
  });

  it('POR_GRAMO sin precio positivo es rechazado y no persiste', async () => {
    const { useCase, servicioRepo } = build();

    await expect(
      useCase.execute({ salonId: 1, id: 10, tipoCostoInsumo: 'POR_GRAMO' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityError);

    expect(servicioRepo.update).not.toHaveBeenCalled();
  });

  it('POR_GRAMO reutiliza el precio existente cuando no se reenvía', async () => {
    const conPrecio = {
      ...existing,
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: 1200,
    } as unknown as ServicioEntity;
    const { useCase, servicioRepo } = build(conPrecio);

    const dto = await useCase.execute({
      salonId: 1,
      id: 10,
      tipoCostoInsumo: 'POR_GRAMO',
    });

    expect(servicioRepo.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ tipoCostoInsumo: 'POR_GRAMO' }),
    );
    expect(dto.precioPorGramo).toBe(1200);
  });

  it('update parcial de precioBase sigue funcionando sin tocar el modo', async () => {
    const { useCase, servicioRepo } = build();

    await useCase.execute({ salonId: 1, id: 10, precioBase: 150 });

    expect(servicioRepo.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ precioBase: 150 }),
    );
    const data = (servicioRepo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(data).not.toHaveProperty('tipoCostoInsumo');
  });

  it('cambiar a FIJO limpia el precioPorGramo', async () => {
    const porGramo = {
      ...existing,
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: 1500,
    } as unknown as ServicioEntity;
    const { useCase, servicioRepo } = build(porGramo);

    await useCase.execute({ salonId: 1, id: 10, tipoCostoInsumo: 'FIJO' });

    expect(servicioRepo.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ tipoCostoInsumo: 'FIJO', precioPorGramo: null }),
    );
  });
});

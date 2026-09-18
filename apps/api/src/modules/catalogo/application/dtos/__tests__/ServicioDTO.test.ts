import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ServicioDTO } from '../ServicioDTO';
import type { ServicioEntity } from '../../../../../infrastructure/persistence/entities/ServicioEntity';

const base = {
  id: 10,
  nombre: 'Tinte',
  descripcion: null,
  precioBase: '45000.00',
  duracionMinutos: 60,
  activo: true,
  costoBaseInsumos: '25000.00',
  categoriaId: 1,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

describe('ServicioDTO — modo de costo', () => {
  it('legacy sin tipoCostoInsumo se lee como FIJO y precioPorGramo null', () => {
    const dto = ServicioDTO.fromEntity(base as unknown as ServicioEntity);

    expect(dto.tipoCostoInsumo).toBe('FIJO');
    expect(dto.precioPorGramo).toBeNull();
    expect(dto.costoBaseInsumos).toBe(25000);
  });

  it('POR_GRAMO expone el tipo y el precio numérico desde un decimal string', () => {
    const dto = ServicioDTO.fromEntity({
      ...base,
      tipoCostoInsumo: 'POR_GRAMO',
      precioPorGramo: '1200.00',
    } as unknown as ServicioEntity);

    expect(dto.tipoCostoInsumo).toBe('POR_GRAMO');
    expect(dto.precioPorGramo).toBe(1200);
  });

  it('FIJO con precioPorGramo nulo se expone como null', () => {
    const dto = ServicioDTO.fromEntity({
      ...base,
      tipoCostoInsumo: 'FIJO',
      precioPorGramo: null,
    } as unknown as ServicioEntity);

    expect(dto.tipoCostoInsumo).toBe('FIJO');
    expect(dto.precioPorGramo).toBeNull();
  });
});

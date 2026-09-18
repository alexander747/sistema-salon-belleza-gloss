import { describe, it, expect } from 'vitest';
import { registroServicioItemToDTO } from '../../../dtos/RegistroServicioItemDTO';
import { RegistroServicioItemEntity } from '../../../../../../infrastructure/persistence/entities/RegistroServicioItemEntity';

describe('RegistroServicioItemDTO', () => {
  it('should map entity to DTO with all snapshot columns', () => {
    const entity = {
      id: 1,
      registroServicioId: 10,
      servicioId: 5,
      nombreServicio: 'Corte de cabello',
      precioServicio: 25000,
      costoBaseInsumos: 5000,
      gramosUsados: null,
      precioPorGramo: null,
    } as RegistroServicioItemEntity;

    const dto = registroServicioItemToDTO(entity);

    expect(dto).toEqual({
      id: 1,
      servicioId: 5,
      nombreServicio: 'Corte de cabello',
      precioServicio: 25000,
      costoBaseInsumos: 5000,
      gramosUsados: null,
      precioPorGramo: null,
    });
  });

  it('should expose the POR_GRAMO gram/price snapshot', () => {
    const entity = {
      id: 2,
      registroServicioId: 10,
      servicioId: 7,
      nombreServicio: 'Tintura',
      precioServicio: 450000,
      costoBaseInsumos: 114000,
      gramosUsados: 95,
      precioPorGramo: 1200,
    } as RegistroServicioItemEntity;

    const dto = registroServicioItemToDTO(entity);

    expect(dto.gramosUsados).toBe(95);
    expect(dto.precioPorGramo).toBe(1200);
    expect(dto.costoBaseInsumos).toBe(114000);
  });

  it('should keep null gram fields for legacy items and preserve their cost', () => {
    const entity = {
      id: 3,
      registroServicioId: 10,
      servicioId: 3,
      nombreServicio: 'Tintura',
      precioServicio: 60500.5,
      costoBaseInsumos: 20000,
      gramosUsados: null,
      precioPorGramo: null,
    } as RegistroServicioItemEntity;

    const dto = registroServicioItemToDTO(entity);

    expect(dto.precioServicio).toBe(60500.5);
    expect(dto.costoBaseInsumos).toBe(20000);
    expect(dto.gramosUsados).toBeNull();
    expect(dto.precioPorGramo).toBeNull();
  });
});

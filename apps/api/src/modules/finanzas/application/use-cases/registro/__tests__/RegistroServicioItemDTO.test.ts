import { describe, it, expect } from 'vitest';
import { registroServicioItemToDTO } from '../../../dtos/RegistroServicioItemDTO';
import { RegistroServicioItemEntity } from '../../../../../infrastructure/persistence/entities/RegistroServicioItemEntity';

describe('RegistroServicioItemDTO', () => {
  it('should map entity to DTO with all snapshot columns', () => {
    const entity = {
      id: 1,
      registroServicioId: 10,
      servicioId: 5,
      nombreServicio: 'Corte de cabello',
      precioServicio: 25000,
      costoBaseInsumos: 5000,
    } as RegistroServicioItemEntity;

    const dto = registroServicioItemToDTO(entity);

    expect(dto).toEqual({
      id: 1,
      servicioId: 5,
      nombreServicio: 'Corte de cabello',
      precioServicio: 25000,
      costoBaseInsumos: 5000,
    });
  });

  it('should handle decimal precioServicio correctly', () => {
    const entity = {
      id: 2,
      registroServicioId: 10,
      servicioId: 3,
      nombreServicio: 'Tintura',
      precioServicio: 60500.50,
      costoBaseInsumos: 0,
    } as RegistroServicioItemEntity;

    const dto = registroServicioItemToDTO(entity);

    expect(dto.precioServicio).toBe(60500.50);
    expect(dto.nombreServicio).toBe('Tintura');
    expect(dto.costoBaseInsumos).toBe(0);
  });
});

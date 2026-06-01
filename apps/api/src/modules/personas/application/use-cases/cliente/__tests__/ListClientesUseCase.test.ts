import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ListClientesUseCase } from '../ListClientesUseCase';
import type { IClienteRepository } from '../../../../domain/ports/IClienteRepository';

function makeMockCliente(id: number, nombre: string, telefono: string) {
  return {
    id,
    nombre,
    telefono,
    email: null,
    puntajeConfianza: 100,
    cantidadNoShows: 0,
    puntosFidelidad: 0,
    totalServicios: 0,
    ultimaVisita: null,
    deudaTotal: 0,
    servicioFrecuente: null,
    activo: true,
    fechaNacimiento: null,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };
}

describe('ListClientesUseCase', () => {
  const createMocks = () => ({
    clienteRepo: {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      findBySalonAndTelefono: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as unknown as IClienteRepository,
  });

  it('should return all clientes for a salon', async () => {
    const mocks = createMocks();
    const mockClientes = [
      makeMockCliente(1, 'Juan', '+541112345'),
      makeMockCliente(2, 'Maria', '+541116789'),
    ];
    mocks.clienteRepo.findBySalon = vi.fn().mockResolvedValue(mockClientes);

    const useCase = new ListClientesUseCase(mocks.clienteRepo);
    const result = await useCase.execute({ salonId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].nombre).toBe('Juan');
    expect(result[1].nombre).toBe('Maria');
    expect(mocks.clienteRepo.findBySalon).toHaveBeenCalledWith(1, undefined);
  });

  it('should filter by telefono when provided', async () => {
    const mocks = createMocks();
    const matchingCliente = makeMockCliente(1, 'Juan', '+541112345');
    mocks.clienteRepo.findBySalon = vi.fn().mockResolvedValue([matchingCliente]);

    const useCase = new ListClientesUseCase(mocks.clienteRepo);
    const result = await useCase.execute({ salonId: 1, telefono: '+541112345' });

    expect(result).toHaveLength(1);
    expect(result[0].telefono).toBe('+541112345');
    expect(mocks.clienteRepo.findBySalon).toHaveBeenCalledWith(1, '+541112345');
  });

  it('should return empty array when no clientes match', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalon = vi.fn().mockResolvedValue([]);

    const useCase = new ListClientesUseCase(mocks.clienteRepo);
    const result = await useCase.execute({ salonId: 1, telefono: '99999' });

    expect(result).toHaveLength(0);
  });
});

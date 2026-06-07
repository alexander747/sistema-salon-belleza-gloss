import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ListClientesUseCase } from '../ListClientesUseCase';
import type { IClienteRepository } from '../../../../domain/ports/IClienteRepository';

function makeMockCliente(id: number, nombre: string, telefono: string, cedula: string | null = null) {
  return {
    id,
    nombre,
    telefono,
    cedula,
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
      findBySalonAndCedula: vi.fn(),
      findBySalonPaginated: vi.fn(),
      countBySalon: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as unknown as IClienteRepository,
  });

  it('should return paginated clientes for a salon', async () => {
    const mocks = createMocks();
    const mockClientes = [
      makeMockCliente(1, 'Juan', '+541112345'),
      makeMockCliente(2, 'Maria', '+541116789'),
    ];
    mocks.clienteRepo.findBySalonPaginated = vi.fn().mockResolvedValue(mockClientes);
    mocks.clienteRepo.countBySalon = vi.fn().mockResolvedValue(2);

    const useCase = new ListClientesUseCase(mocks.clienteRepo);
    const result = await useCase.execute({ salonId: 1, page: 1, limit: 12 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].nombre).toBe('Juan');
    expect(result.data[1].nombre).toBe('Maria');
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(12);
    expect(result.meta.totalPages).toBe(1);
    expect(mocks.clienteRepo.findBySalonPaginated).toHaveBeenCalledWith(1, { skip: 0, take: 12, q: undefined });
    expect(mocks.clienteRepo.countBySalon).toHaveBeenCalledWith(1, undefined);
  });

  it('should pass search query to repository', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonPaginated = vi.fn().mockResolvedValue([]);
    mocks.clienteRepo.countBySalon = vi.fn().mockResolvedValue(0);

    const useCase = new ListClientesUseCase(mocks.clienteRepo);
    await useCase.execute({ salonId: 1, page: 1, limit: 12, q: 'Juan' });

    expect(mocks.clienteRepo.findBySalonPaginated).toHaveBeenCalledWith(1, { skip: 0, take: 12, q: 'Juan' });
    expect(mocks.clienteRepo.countBySalon).toHaveBeenCalledWith(1, 'Juan');
  });

  it('should use skip=undefined when limit is 0 (all results)', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonPaginated = vi.fn().mockResolvedValue([]);
    mocks.clienteRepo.countBySalon = vi.fn().mockResolvedValue(0);

    const useCase = new ListClientesUseCase(mocks.clienteRepo);
    await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(mocks.clienteRepo.findBySalonPaginated).toHaveBeenCalledWith(1, { skip: undefined, take: undefined, q: undefined });
  });
});

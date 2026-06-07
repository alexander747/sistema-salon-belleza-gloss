import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { CreateClienteUseCase } from '../CreateClienteUseCase';
import type { IClienteRepository } from '../../../../domain/ports/IClienteRepository';

function makeMockCliente(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    nombre: 'Juan',
    telefono: '+541112345',
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
    ...overrides,
  };
}

describe('CreateClienteUseCase', () => {
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

  it('should create a new cliente when phone does not exist', async () => {
    const mocks = createMocks();
    const mockCliente = makeMockCliente();
    mocks.clienteRepo.findBySalonAndTelefono = vi.fn().mockResolvedValue(null);
    mocks.clienteRepo.create = vi.fn().mockResolvedValue(mockCliente);

    const useCase = new CreateClienteUseCase(mocks.clienteRepo);
    const result = await useCase.execute({
      salonId: 1,
      nombre: 'Juan',
      telefono: '+541112345',
    });

    expect(result.created).toBe(true);
    expect(result.cliente.id).toBe(10);
    expect(result.cliente.nombre).toBe('Juan');
    expect(result.cliente.telefono).toBe('+541112345');
    expect(mocks.clienteRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Juan',
        telefono: '+541112345',
        salonId: 1,
        activo: true,
        puntajeConfianza: 100,
      }),
    );
  });

  it('should return existing cliente when duplicate phone is found (idempotent)', async () => {
    const mocks = createMocks();
    const existingCliente = makeMockCliente({ id: 10, nombre: 'Juan' });
    mocks.clienteRepo.findBySalonAndTelefono = vi.fn().mockResolvedValue(existingCliente);

    const useCase = new CreateClienteUseCase(mocks.clienteRepo);
    const result = await useCase.execute({
      salonId: 1,
      nombre: 'Juan',
      telefono: '+541112345',
    });

    expect(result.created).toBe(false);
    expect(result.cliente.id).toBe(10);
    expect(result.cliente.nombre).toBe('Juan');
    expect(mocks.clienteRepo.create).not.toHaveBeenCalled();
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation.
// Must export the class name so getRepository(ClienteEntity) resolves.
vi.mock('../../../../../../infrastructure/persistence/entities/ClienteEntity.js', () => ({
  ClienteEntity: class ClienteEntity {
    id: number;
    totalServicios: number;
    deudaTotal: number;
  },
}));
vi.mock('../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

// Mock database
vi.mock('../../../../../../shared/database.js', () => ({
  AppDataSource: {
    createQueryRunner: vi.fn(() => ({
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        getRepository: vi.fn(() => ({
          update: vi.fn(),
        })),
      },
    })),
  },
}));

import { CreateRegistroUseCase } from '../CreateRegistroUseCase';
import { NotFoundError } from '../../../../../../shared/errors';
import type { CreateRegistroInput } from '@pos-final/validation';

// ── Mocks ──────────────────────────────────────────────────────
const mockRegistroRepo = {
  create: vi.fn(),
  findById: vi.fn(),
};
const mockPagoRepo = {
  bulkCreate: vi.fn(),
};
const mockDivisionRepo = {
  create: vi.fn(),
};
const mockClienteRepo = {
  findBySalonAndId: vi.fn(),
};
const mockUsuarioRepo = {
  findBySalonAndId: vi.fn(),
};
const mockComisionService = {
  calcularComision: vi.fn(),
  calcularMontoTotal: vi.fn(),
  calcularMontoPendiente: vi.fn(),
};
const mockProductoRepo = {
  decrementStock: vi.fn(),
};

describe('CreateRegistroUseCase', () => {
  let useCase: CreateRegistroUseCase;

  const validInput: CreateRegistroInput = {
    salonId: 1,
    clienteId: 1,
    usuarioId: 2,
    totalServicios: 100000,
    totalProductos: 50000,
    propina: 10000,
    esRetoque: false,
    pagos: [
      { monto: 100000, metodoPago: 'EFECTIVO' },
    ],
    divisiones: [],
    porcentajeDescuento: 0,
    productosVendidos: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateRegistroUseCase(
      mockRegistroRepo as never,
      mockPagoRepo as never,
      mockDivisionRepo as never,
      mockClienteRepo as never,
      mockUsuarioRepo as never,
      mockComisionService as never,
      mockProductoRepo as never,
    );
  });

  it('should create a registro with commissions calculated correctly', async () => {
    const mockCliente = { id: 1, totalServicios: 5, deudaTotal: 50000 };
    const mockUsuario = { id: 2, porcentajeComisionServicio: '60' };
    const mockSaved = {
      id: 1,
      salonId: 1,
      clienteId: 1,
      usuarioId: 2,
      totalServicios: 100000,
      totalProductos: 50000,
      montoTotal: 160000,
      propina: 10000,
      comisionCalculada: 60000,
      esRetoque: false,
      montoPendiente: 50000,
      estaPagadaEmpleada: false,
      notas: null,
      descripcionServicio: null,
      pagos: [{ id: 1, monto: 100000, metodoPago: 'EFECTIVO', referencia: null, creadoEn: new Date() }],
      divisiones: [],
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };

    mockClienteRepo.findBySalonAndId.mockResolvedValue(mockCliente);
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(mockUsuario);
    mockComisionService.calcularComision.mockReturnValue(60000);
    mockComisionService.calcularMontoTotal.mockReturnValue(160000);
    mockComisionService.calcularMontoPendiente.mockReturnValue(50000);
    mockRegistroRepo.create.mockResolvedValue({ id: 1 });
    mockPagoRepo.bulkCreate.mockResolvedValue([]);
    mockRegistroRepo.findById.mockResolvedValue(mockSaved);

    const result = await useCase.execute(validInput);

    expect(mockClienteRepo.findBySalonAndId).toHaveBeenCalledWith(1, 1);
    expect(mockUsuarioRepo.findBySalonAndId).toHaveBeenCalledWith(1, 2);

    expect(mockComisionService.calcularComision).toHaveBeenCalledWith(100000, 60);
    expect(mockComisionService.calcularMontoTotal).toHaveBeenCalledWith(100000, 50000, 10000);
    expect(mockComisionService.calcularMontoPendiente).toHaveBeenCalledWith(100000, 50000, 100000);

    expect(mockRegistroRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 1,
        clienteId: 1,
        usuarioId: 2,
        totalServicios: 100000,
        totalProductos: 50000,
        propina: 10000,
        comisionCalculada: 60000,
        // Price adjustment fields
        precioAjustado: false,
        porcentajeDescuento: 0,
        valorOriginal: 160000,
        valorFinal: 160000,
      }),
      expect.anything(),
    );

    expect(result).toEqual(expect.objectContaining({
      id: 1,
      comisionCalculada: 60000,
      montoTotal: 160000,
      montoPendiente: 50000,
    }));
  });

  it('should throw NotFoundError when cliente does not exist', async () => {
    mockClienteRepo.findBySalonAndId.mockResolvedValue(null);

    await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundError);
    expect(mockRegistroRepo.create).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when usuario does not exist', async () => {
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1 });
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(null);

    await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundError);
    expect(mockRegistroRepo.create).not.toHaveBeenCalled();
  });
});

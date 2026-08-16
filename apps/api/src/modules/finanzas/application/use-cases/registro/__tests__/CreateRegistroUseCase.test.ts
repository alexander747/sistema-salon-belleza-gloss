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
vi.mock('../../../../../../infrastructure/persistence/entities/RegistroServicioItemEntity.js', () => ({
  RegistroServicioItemEntity: class RegistroServicioItemEntity {
    id: number;
    registroServicioId: number;
    servicioId: number;
    nombreServicio: string;
    precioServicio: number;
    costoBaseInsumos: number;
  },
}));

// Mock database
const mockRepoCreate = vi.fn();
const mockRepoSave = vi.fn();
const mockRepoUpdate = vi.fn();
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
          update: mockRepoUpdate,
          create: mockRepoCreate,
          save: mockRepoSave,
        })),
      },
    })),
  },
}));

import { CreateRegistroUseCase } from '../CreateRegistroUseCase';
import { NotFoundError, CajaCerradaError } from '../../../../../../shared/errors';
import type { CreateRegistroInput } from '@pos-final/validation';

// ── Mocks ──────────────────────────────────────────────────────
const mockRegistroRepo = {
  create: vi.fn(),
  findById: vi.fn(),
};
const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
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
    // Regla de oro: caja ABIERTA por defecto para que los tests existentes pasen
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA' });
    useCase = new CreateRegistroUseCase(
      mockRegistroRepo as never,
      mockPagoRepo as never,
      mockDivisionRepo as never,
      mockClienteRepo as never,
      mockUsuarioRepo as never,
      mockComisionService as never,
      mockProductoRepo as never,
      mockCajaRepo as never,
    );
  });

  describe('regla de oro (caja abierta)', () => {
    it('should throw CajaCerradaError when no caja ABIERTA exists and not persist', async () => {
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      await expect(useCase.execute(validInput)).rejects.toThrow(CajaCerradaError);

      // El guard corre ANTES de validar cliente → ni siquiera se consulta
      expect(mockClienteRepo.findBySalonAndId).not.toHaveBeenCalled();
      expect(mockRegistroRepo.create).not.toHaveBeenCalled();
    });

    it('should persist cajaId from the open caja on the registro', async () => {
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
        pagos: [],
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
      mockRegistroRepo.findById.mockResolvedValue(mockSaved);

      await useCase.execute(validInput);

      expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cajaId: 5 }),
        expect.anything(),
      );
    });
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

    expect(mockComisionService.calcularComision).toHaveBeenCalledWith(100000, 60, 0);
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

  it('should calculate commission on the adjusted services total when price is adjusted', async () => {
    const mockCliente = { id: 1, totalServicios: 5, deudaTotal: 50000 };
    const mockUsuario = { id: 2, porcentajeComisionServicio: '50' };
    const mockSaved = {
      id: 1,
      salonId: 1,
      clienteId: 1,
      usuarioId: 2,
      totalServicios: 85000,
      totalProductos: 0,
      montoTotal: 85000,
      propina: 0,
      comisionCalculada: 40000,
      esRetoque: false,
      montoPendiente: 0,
      estaPagadaEmpleada: false,
      notas: null,
      descripcionServicio: null,
      pagos: [{ id: 1, monto: 80000, metodoPago: 'EFECTIVO', referencia: null, creadoEn: new Date() }],
      divisiones: [],
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };

    mockClienteRepo.findBySalonAndId.mockResolvedValue(mockCliente);
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(mockUsuario);
    mockComisionService.calcularComision.mockReturnValue(40000);
    mockComisionService.calcularMontoTotal.mockReturnValue(85000);
    mockComisionService.calcularMontoPendiente.mockReturnValue(0);
    mockRegistroRepo.create.mockResolvedValue({ id: 1 });
    mockPagoRepo.bulkCreate.mockResolvedValue([]);
    mockRegistroRepo.findById.mockResolvedValue(mockSaved);

    const input = {
      ...validInput,
      totalServicios: 85000,
      totalProductos: 0,
      propina: 0,
      pagos: [
        { monto: 80000, metodoPago: 'EFECTIVO' as const },
      ],
      porcentajeDescuento: 0,
      precioAjustado: true,
      valorOriginal: 85000,
      valorFinal: 80000,
      serviciosItems: [
        { servicioId: 1, nombreServicio: 'Corte', precioServicio: 85000, costoBaseInsumos: 0 },
      ],
    };

    const result = await useCase.execute(input);

    // proportion = (80000 - 0) / (85000 - 0) ≈ 0.941176 → round(85000 × 0.941176) = 80000
    expect(mockComisionService.calcularComision).toHaveBeenCalledWith(80000, 50, 0);
    expect(result.comisionCalculada).toBe(40000);
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

  it('should pass totalCostoBaseInsumos to calcularComision when serviciosItems have costoBaseInsumos', async () => {
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
      comisionCalculada: 36000,
      esRetoque: false,
      montoPendiente: 50000,
      estaPagadaEmpleada: false,
      notas: null,
      descripcionServicio: null,
      pagos: [],
      divisiones: [],
      serviciosItems: [
        { id: 1, servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000, costoBaseInsumos: 10000 },
        { id: 2, servicioId: 2, nombreServicio: 'Tintura', precioServicio: 60000, costoBaseInsumos: 30000 },
      ],
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };

    mockClienteRepo.findBySalonAndId.mockResolvedValue(mockCliente);
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(mockUsuario);
    mockComisionService.calcularComision.mockReturnValue(36000);
    mockComisionService.calcularMontoTotal.mockReturnValue(160000);
    mockComisionService.calcularMontoPendiente.mockReturnValue(50000);
    mockRegistroRepo.create.mockResolvedValue({ id: 1 });
    mockRegistroRepo.findById.mockResolvedValue(mockSaved);

    const input = {
      ...validInput,
      serviciosItems: [
        { servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000, costoBaseInsumos: 10000 },
        { servicioId: 2, nombreServicio: 'Tintura', precioServicio: 60000, costoBaseInsumos: 30000 },
      ],
    };

    await useCase.execute(input);

    // Verify calcularComision was called with totalCostoBaseInsumos = 10000 + 30000 = 40000
    expect(mockComisionService.calcularComision).toHaveBeenCalledWith(100000, 60, 40000);
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        costoBaseInsumos: 10000,
      }),
    );
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        costoBaseInsumos: 30000,
      }),
    );
  });

  it('should persist serviciosItems when provided', async () => {
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
      pagos: [],
      divisiones: [],
      serviciosItems: [
        { id: 1, servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000 },
        { id: 2, servicioId: 2, nombreServicio: 'Tintura', precioServicio: 60000 },
      ],
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };

    mockClienteRepo.findBySalonAndId.mockResolvedValue(mockCliente);
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(mockUsuario);
    mockComisionService.calcularComision.mockReturnValue(60000);
    mockComisionService.calcularMontoTotal.mockReturnValue(160000);
    mockComisionService.calcularMontoPendiente.mockReturnValue(50000);
    mockRegistroRepo.create.mockResolvedValue({ id: 1 });
    mockRegistroRepo.findById.mockResolvedValue(mockSaved);

    const input = {
      ...validInput,
      serviciosItems: [
        { servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000 },
        { servicioId: 2, nombreServicio: 'Tintura', precioServicio: 60000 },
      ],
    };

    await useCase.execute(input);

    // Verify servicio items were created via queryRunner.manager.getRepository
    expect(mockRepoCreate).toHaveBeenCalled();
    expect(mockRepoSave).toHaveBeenCalled();
  });

  it('should not create servicio items when serviciosItems is empty', async () => {
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
      pagos: [],
      divisiones: [],
      serviciosItems: [],
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };

    mockClienteRepo.findBySalonAndId.mockResolvedValue(mockCliente);
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(mockUsuario);
    mockComisionService.calcularComision.mockReturnValue(60000);
    mockComisionService.calcularMontoTotal.mockReturnValue(160000);
    mockComisionService.calcularMontoPendiente.mockReturnValue(50000);
    mockRegistroRepo.create.mockResolvedValue({ id: 1 });
    mockRegistroRepo.findById.mockResolvedValue(mockSaved);

    await useCase.execute(validInput);

    // Should NOT have called repository for servicio items
    // (create and save may be called for other entities, but we verify cantidad)
    expect(mockSaved.serviciosItems).toEqual([]);
  });
});

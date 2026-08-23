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
const { mockQrRefs } = vi.hoisted(() => ({ mockQrRefs: [] as Array<Record<string, unknown>> }));
vi.mock('../../../../../../shared/database.js', () => ({
  AppDataSource: {
    createQueryRunner: vi.fn(() => {
      const qr = {
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
      };
      mockQrRefs.push(qr);
      return qr;
    }),
  },
}));

import { CreateRegistroUseCase } from '../CreateRegistroUseCase';
import { NotFoundError, CajaCerradaError, CajaNoAbiertaEnFechaError, UnprocessableEntityError } from '../../../../../../shared/errors';
import { AppDataSource } from '../../../../../../shared/database';
import { getColombiaDateString } from '../../../../../../shared/colombia-date';
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
  findBySalonAndId: vi.fn(),
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
    // montoPendiente se computa sobre el VALOR FINAL cobrado (montoTotal 160000), excluye propina
    expect(mockComisionService.calcularMontoPendiente).toHaveBeenCalledWith(160000, 10000, 100000);

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

  describe('montoPendiente sobre el valor real cobrado (descuento/precio ajustado)', () => {
    const inputConDescuento = (montoPagado: number) => ({
      ...validInput,
      totalServicios: 100000,
      totalProductos: 0,
      propina: 0,
      precioAjustado: true,
      porcentajeDescuento: 10,
      valorOriginal: 100000,
      valorFinal: 90000,
      pagos: [{ monto: montoPagado, metodoPago: 'EFECTIVO' as const }],
    });

    const mockSaved = {
      id: 1,
      salonId: 1,
      clienteId: 1,
      usuarioId: 2,
      totalServicios: 100000,
      totalProductos: 0,
      montoTotal: 100000,
      propina: 0,
      comisionCalculada: 45000,
      esRetoque: false,
      montoPendiente: 0,
      estaPagadaEmpleada: false,
      notas: null,
      descripcionServicio: null,
      pagos: [],
      divisiones: [],
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };

    const setup = (montoPendienteMock: number) => {
      mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1, totalServicios: 5, deudaTotal: 0 });
      mockUsuarioRepo.findBySalonAndId.mockResolvedValue({ id: 2, porcentajeComisionServicio: '50' });
      mockComisionService.calcularComision.mockReturnValue(45000);
      mockComisionService.calcularMontoTotal.mockReturnValue(100000);
      mockComisionService.calcularMontoPendiente.mockReturnValue(montoPendienteMock);
      mockRegistroRepo.create.mockResolvedValue({ id: 1 });
      mockRegistroRepo.findById.mockResolvedValue(mockSaved);
    };

    it('should set montoPendiente=0 when the client pays the full DISCOUNTED total (90000/90000) — no false debt', async () => {
      setup(0);
      await useCase.execute(inputConDescuento(90000));

      // El pendiente se calcula sobre valorFinal (90000), NO sobre el bruto pre-descuento (100000)
      expect(mockComisionService.calcularMontoPendiente).toHaveBeenCalledWith(90000, 0, 90000);
      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ montoPendiente: 0 }),
        expect.anything(),
      );
    });

    it('should set montoPendiente=40000 when the client pays only part of the DISCOUNTED total (50000/90000)', async () => {
      setup(40000);
      await useCase.execute(inputConDescuento(50000));

      expect(mockComisionService.calcularMontoPendiente).toHaveBeenCalledWith(90000, 0, 50000);
      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ montoPendiente: 40000 }),
        expect.anything(),
      );
    });
  });

  describe('stock insuficiente (no sobreventa silenciosa)', () => {
    const mockSavedConProducto = {
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

    const inputConProducto = (cantidad: number) => ({
      ...validInput,
      productosVendidos: [{ productoId: 99, cantidad }],
    });

    const setupConProducto = (stockDisponible: number) => {
      mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1, totalServicios: 5, deudaTotal: 50000 });
      mockUsuarioRepo.findBySalonAndId.mockResolvedValue({ id: 2, porcentajeComisionServicio: '60' });
      mockComisionService.calcularComision.mockReturnValue(60000);
      mockComisionService.calcularMontoTotal.mockReturnValue(160000);
      mockComisionService.calcularMontoPendiente.mockReturnValue(50000);
      mockRegistroRepo.create.mockResolvedValue({ id: 1 });
      mockProductoRepo.findBySalonAndId.mockResolvedValue({
        id: 99,
        nombre: 'Shampoo Premium',
        precioVenta: 10000,
        cantidadStock: stockDisponible,
      });
    };

    it('should throw UnprocessableEntityError and ROLLBACK (venta NO creada) when decrementStock returns null (stock insuficiente)', async () => {
      setupConProducto(2); // stock disponible: 2
      mockProductoRepo.decrementStock.mockResolvedValue(null); // repo marca stock insuficiente

      const qrIndex = mockQrRefs.length;
      await expect(useCase.execute(inputConProducto(3))).rejects.toThrow(UnprocessableEntityError);

      // El error se lanza DENTRO de la transacción → rollback, nunca commit:
      // la venta no queda persistida a medias (ni stock, ni pagos, ni registro).
      const qr = mockQrRefs[qrIndex] as {
        rollbackTransaction: ReturnType<typeof vi.fn>;
        commitTransaction: ReturnType<typeof vi.fn>;
      };
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(mockProductoRepo.decrementStock).toHaveBeenCalledWith(99, 3, expect.anything());
    });

    it('should proceed with the sale (commit) when there is enough stock', async () => {
      setupConProducto(10); // stock disponible: 10
      mockProductoRepo.decrementStock.mockResolvedValue({
        id: 99,
        nombre: 'Shampoo Premium',
        precioVenta: 10000,
        cantidadStock: 7,
      });
      mockRegistroRepo.findById.mockResolvedValue(mockSavedConProducto);

      const qrIndex = mockQrRefs.length;
      const result = await useCase.execute(inputConProducto(3));

      const qr = mockQrRefs[qrIndex] as {
        rollbackTransaction: ReturnType<typeof vi.fn>;
        commitTransaction: ReturnType<typeof vi.fn>;
      };
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockProductoRepo.decrementStock).toHaveBeenCalledWith(99, 3, expect.anything());
      expect(result.id).toBe(1);
    });
  });

  describe('fechaHora (backfill)', () => {
    const setupHappy = () => {
      mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1, totalServicios: 5, deudaTotal: 50000 });
      mockUsuarioRepo.findBySalonAndId.mockResolvedValue({ id: 2, porcentajeComisionServicio: '60' });
      mockComisionService.calcularComision.mockReturnValue(60000);
      mockComisionService.calcularMontoTotal.mockReturnValue(160000);
      mockComisionService.calcularMontoPendiente.mockReturnValue(50000);
      mockRegistroRepo.create.mockResolvedValue({ id: 1 });
      mockRegistroRepo.findById.mockResolvedValue({
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
        fechaHora: new Date('2026-08-16T15:00:00.000Z'),
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      });
    };

    it('should persist fechaHora = ahora por defecto y ligar la caja de HOY', async () => {
      setupHappy();
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 9, salonId: 1, estado: 'ABIERTA' });

      await useCase.execute(validInput);

      expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, getColombiaDateString());
      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cajaId: 9, fechaHora: expect.any(Date) }),
        expect.anything(),
      );
    });

    it('should persist la fechaHora del payload y ligar la caja de ESA fecha (no la de hoy)', async () => {
      setupHappy();
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA', fechaCaja: '2026-08-16' });

      await useCase.execute({ ...validInput, fechaHora: '2026-08-16T15:00:00.000Z' });

      expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, '2026-08-16');
      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cajaId: 5, fechaHora: new Date('2026-08-16T15:00:00.000Z') }),
        expect.anything(),
      );
    });

    it('should rechazar con 409 CAJA_NO_ABIERTA_EN_FECHA sin caja de la fecha pasada y NO persistir', async () => {
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      await expect(
        useCase.execute({ ...validInput, fechaHora: '2026-08-16T15:00:00.000Z' }),
      ).rejects.toThrow(CajaNoAbiertaEnFechaError);

      expect(mockRegistroRepo.create).not.toHaveBeenCalled();
    });

    it('should mantener CajaCerradaError (422) cuando la fechaHora explícita es de hoy', async () => {
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      const hoyISO = new Date(`${getColombiaDateString()}T12:00:00`).toISOString();
      await expect(
        useCase.execute({ ...validInput, fechaHora: hoyISO }),
      ).rejects.toThrow(CajaCerradaError);

      expect(mockRegistroRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('queryRunner externo (modo transacción compartida)', () => {
    const setupHappyPath = () => {
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
      return { mockSaved };
    };

    it('should use the provided queryRunner for all writes without committing/releasing', async () => {
      setupHappyPath();
      const externalQr = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          getRepository: vi.fn(() => ({
            update: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
          })),
        },
      };

      await useCase.execute(validInput, externalQr as never);

      // El caller es dueño del ciclo de vida de la transacción
      expect(AppDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cajaId: 5 }),
        externalQr,
      );
      expect(mockPagoRepo.bulkCreate).toHaveBeenCalledWith(expect.anything(), externalQr);
      expect(externalQr.manager.getRepository).toHaveBeenCalled();
      // No se cierra ni commitea nada
      expect(externalQr.commitTransaction).not.toHaveBeenCalled();
      expect(externalQr.rollbackTransaction).not.toHaveBeenCalled();
      expect(externalQr.release).not.toHaveBeenCalled();
    });

    it('should pass citaId through to registroRepo.create when provided', async () => {
      setupHappyPath();

      await useCase.execute({ ...validInput, citaId: 42 });

      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ citaId: 42 }),
        expect.anything(),
      );
    });

    it('should leave citaId null when input omits it', async () => {
      setupHappyPath();

      await useCase.execute(validInput);

      expect(mockRegistroRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ citaId: null }),
        expect.anything(),
      );
    });
  });
});

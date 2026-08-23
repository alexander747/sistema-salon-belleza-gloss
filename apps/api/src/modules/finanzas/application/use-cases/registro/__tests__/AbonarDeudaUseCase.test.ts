import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation (patrón CreateRegistroUseCase.test.ts)
vi.mock('../../../../../../infrastructure/persistence/entities/ClienteEntity.js', () => ({
  ClienteEntity: class ClienteEntity {
    id: number;
    deudaTotal: number;
  },
}));
vi.mock('../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));
vi.mock('../../../../../../infrastructure/persistence/entities/RegistroServicioEntity.js', () => ({
  RegistroServicioEntity: class RegistroServicioEntity {},
  EstadoRegistro: { ACTIVO: 'ACTIVO', ANULADO: 'ANULADO' },
}));

// Mock database (transacción propia: createQueryRunner)
const mockRepoUpdate = vi.fn();
const mockRepoCreate = vi.fn();
const mockRepoSave = vi.fn();
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

import { AbonarDeudaUseCase } from '../AbonarDeudaUseCase';
import {
  RegistroNoEncontradoError,
  RegistroAnuladoError,
  MontoExcedePendienteError,
  CajaCerradaError,
  ValidationError,
} from '../../../../../../shared/errors';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import { getColombiaDateString } from '../../../../../../shared/colombia-date';

// ── Mocks ──────────────────────────────────────────────────────
const mockRegistroRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};
const mockPagoRepo = {
  create: vi.fn(),
};
const mockClienteRepo = {
  findBySalonAndId: vi.fn(),
};
const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

const makeRegistro = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  salonId: 1,
  clienteId: 1,
  usuarioId: 2,
  estado: EstadoRegistro.ACTIVO,
  totalServicios: 100000,
  totalProductos: 0,
  montoTotal: 100000,
  propina: 0,
  comisionCalculada: 60000,
  esRetoque: false,
  descripcionServicio: null,
  estaPagadaEmpleada: false,
  notas: null,
  precioAjustado: false,
  porcentajeDescuento: 0,
  valorOriginal: 100000,
  valorFinal: 100000,
  montoPendiente: 40000,
  pagos: [],
  divisiones: [],
  productosVendidos: [],
  serviciosItems: [],
  fechaHora: new Date('2026-08-10T10:00:00.000Z'),
  creadoEn: new Date('2026-08-10T10:00:00.000Z'),
  actualizadoEn: new Date('2026-08-10T10:00:00.000Z'),
  ...overrides,
});

describe('AbonarDeudaUseCase', () => {
  let useCase: AbonarDeudaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    // Regla de oro: caja ABIERTA hoy por defecto
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 7, salonId: 1, estado: 'ABIERTA' });
    useCase = new AbonarDeudaUseCase(
      mockRegistroRepo as never,
      mockPagoRepo as never,
      mockClienteRepo as never,
      mockCajaRepo as never,
    );
  });

  it('abono parcial: crea el pago ligado a la caja de HOY y decrementa montoPendiente + deudaTotal', async () => {
    const registro = makeRegistro({ montoPendiente: 40000 });
    mockRegistroRepo.findById
      .mockResolvedValueOnce(registro)
      .mockResolvedValueOnce({
        ...registro,
        montoPendiente: 15000,
        pagos: [{ id: 99, monto: 25000, metodoPago: 'EFECTIVO', referencia: null, creadoEn: new Date() }],
      });
    mockRegistroRepo.update.mockResolvedValue({ ...registro, montoPendiente: 15000 });
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1, deudaTotal: 80000 });
    mockPagoRepo.create.mockResolvedValue({ id: 99 });

    const result = await useCase.execute({
      salonId: 1,
      registroId: 5,
      monto: 25000,
      metodoPago: 'EFECTIVO',
    });

    // Caja resuelta HOY (default de verificarCajaAbierta)
    expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, getColombiaDateString());
    // Pago creado DENTRO de la transacción con cajaId = caja de hoy
    expect(mockPagoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        registroServicioId: 5,
        monto: 25000,
        metodoPago: 'EFECTIVO',
        cajaId: 7,
      }),
      expect.anything(),
    );
    expect(mockRegistroRepo.update).toHaveBeenCalledWith(5, { montoPendiente: 15000 }, expect.anything());
    // deudaTotal del cliente reducida en la misma transacción (80000 − 25000)
    expect(mockRepoUpdate).toHaveBeenCalledWith(1, { deudaTotal: 55000 });
    // Respuesta: DTO del registro actualizado con pagos
    expect(result.montoPendiente).toBe(15000);
    expect(result.pagos).toHaveLength(1);
  });

  it('abono que salda: montoPendiente llega a 0 y la deuda se reduce en el monto completo', async () => {
    const registro = makeRegistro({ montoPendiente: 40000 });
    mockRegistroRepo.findById
      .mockResolvedValueOnce(registro)
      .mockResolvedValueOnce({
        ...registro,
        montoPendiente: 0,
        pagos: [{ id: 99, monto: 40000, metodoPago: 'TRANSFERENCIA', referencia: 'AB-1', creadoEn: new Date() }],
      });
    mockRegistroRepo.update.mockResolvedValue({ ...registro, montoPendiente: 0 });
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1, deudaTotal: 40000 });
    mockPagoRepo.create.mockResolvedValue({ id: 99 });

    const result = await useCase.execute({
      salonId: 1,
      registroId: 5,
      monto: 40000,
      metodoPago: 'TRANSFERENCIA',
      referencia: 'AB-1',
    });

    expect(mockRegistroRepo.update).toHaveBeenCalledWith(5, { montoPendiente: 0 }, expect.anything());
    expect(mockRepoUpdate).toHaveBeenCalledWith(1, { deudaTotal: 0 });
    expect(mockPagoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ monto: 40000, referencia: 'AB-1' }),
      expect.anything(),
    );
    expect(result.montoPendiente).toBe(0);
  });

  it('409 MONTO_EXCEDE_PENDIENTE cuando el abono supera la deuda y NO persiste nada', async () => {
    mockRegistroRepo.findById.mockResolvedValue(makeRegistro({ montoPendiente: 40000 }));

    await expect(
      useCase.execute({ salonId: 1, registroId: 5, monto: 45000, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(MontoExcedePendienteError);

    expect(mockPagoRepo.create).not.toHaveBeenCalled();
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
    // El error dentro de la transacción → rollback, nunca commit
    const qr = mockQrRefs[mockQrRefs.length - 1] as { commitTransaction: ReturnType<typeof vi.fn> };
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });

  it('422 REGISTRO_ANULADO cuando el registro está anulado (sin pagos creados)', async () => {
    mockRegistroRepo.findById.mockResolvedValue(
      makeRegistro({ estado: EstadoRegistro.ANULADO, montoPendiente: 0 }),
    );

    await expect(
      useCase.execute({ salonId: 1, registroId: 5, monto: 10000, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(RegistroAnuladoError);

    expect(mockPagoRepo.create).not.toHaveBeenCalled();
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
  });

  it('404 REGISTRO_NO_ENCONTRADO cuando el registro no existe o es de otro salón', async () => {
    // Registro inexistente
    mockRegistroRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ salonId: 1, registroId: 999, monto: 10000, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(RegistroNoEncontradoError);

    // Registro de otro salón
    mockRegistroRepo.findById.mockResolvedValue(makeRegistro({ salonId: 99 }));
    await expect(
      useCase.execute({ salonId: 1, registroId: 5, monto: 10000, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(RegistroNoEncontradoError);

    expect(mockPagoRepo.create).not.toHaveBeenCalled();
  });

  it('422 CAJA_CERRADA cuando no hay caja ABIERTA hoy (regla de oro) y NO persiste nada', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    await expect(
      useCase.execute({ salonId: 1, registroId: 5, monto: 10000, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(CajaCerradaError);

    // El guard corre ANTES de abrir la transacción → ni se consulta el registro
    expect(mockRegistroRepo.findById).not.toHaveBeenCalled();
    expect(mockPagoRepo.create).not.toHaveBeenCalled();
  });

  it('400 ValidationError cuando el monto no es positivo (0 o negativo)', async () => {
    await expect(
      useCase.execute({ salonId: 1, registroId: 5, monto: 0, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute({ salonId: 1, registroId: 5, monto: -5, metodoPago: 'EFECTIVO' }),
    ).rejects.toThrow(ValidationError);

    // Guard de monto corre ANTES de la regla de oro
    expect(mockCajaRepo.findAbiertaBySalonYFecha).not.toHaveBeenCalled();
    expect(mockPagoRepo.create).not.toHaveBeenCalled();
  });
});

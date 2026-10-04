import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks de entidades (evitan la evaluación de decoradores de TypeORM) ──

vi.mock('../../../../../../infrastructure/persistence/entities/ClienteEntity.js', () => ({
  ClienteEntity: class ClienteEntity {
    id: number;
    deudaTotal: number;
  },
}));

interface FakeQr {
  connect: ReturnType<typeof vi.fn>;
  startTransaction: ReturnType<typeof vi.fn>;
  commitTransaction: ReturnType<typeof vi.fn>;
  rollbackTransaction: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  manager: { getRepository: ReturnType<typeof vi.fn> };
}

// Mock de la base: queryRunner fake con manager.getRepository(ClienteEntity)
const mockRepoUpdate = vi.fn();
const mockRepoCreate = vi.fn();
const mockRepoSave = vi.fn();
const { mockQrRefs } = vi.hoisted(() => ({ mockQrRefs: [] as FakeQr[] }));
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
      mockQrRefs.push(qr as FakeQr);
      return qr;
    }),
  },
}));

import { CreateDevolucionUseCase } from '../CreateDevolucionUseCase';
import { CajaCerradaError, NotFoundError, UnprocessableEntityError, ValidationError } from '../../../../../../shared/errors';

// ── Repos mockeados ─────────────────────────────────────────────

const mockDevolucionRepo = {
  create: vi.fn(),
};
const mockProductoRepo = {
  incrementStock: vi.fn(),
};
const mockRegistroRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};
const mockClienteRepo = {
  findBySalonAndId: vi.fn(),
};
const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

const makeRegistro = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  salonId: 1,
  clienteId: 3,
  montoPendiente: 100000,
  montoTotal: 100000,
  productosVendidos: [] as { productoId: number; cantidad: number; subtotal: number }[],
  devoluciones: [] as { productoId: number | null; cantidad: number; montoDevolucion: number }[],
  ...overrides,
});

describe('CreateDevolucionUseCase', () => {
  let useCase: CreateDevolucionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQrRefs.length = 0;
    // Caja ABIERTA por defecto (regla de oro)
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA' });
    mockDevolucionRepo.create.mockResolvedValue({ id: 99, montoDevolucion: 30000 });
    mockProductoRepo.incrementStock.mockResolvedValue({ id: 1 });
    mockRegistroRepo.findById.mockResolvedValue(makeRegistro());
    mockRegistroRepo.update.mockResolvedValue(makeRegistro());
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 3, deudaTotal: 100000 });
    useCase = new CreateDevolucionUseCase(
      mockDevolucionRepo as never,
      mockProductoRepo as never,
      mockRegistroRepo as never,
      mockClienteRepo as never,
      mockCajaRepo as never,
    );
  });

  it('lanza CajaCerradaError (422) cuando no hay caja abierta', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    const promise = useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Cliente insatisfecho',
      cantidad: 1,
      montoDevolucion: 30000,
      regresaAlStock: true,
    });

    await expect(promise).rejects.toBeInstanceOf(CajaCerradaError);
    // Nada se persiste: ni devolución ni ajuste de deuda
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
  });

  it('reduce montoPendiente del registro y deudaTotal del cliente en la misma transacción', async () => {
    await useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'No le gustó el servicio',
      cantidad: 1,
      montoDevolucion: 30000,
      regresaAlStock: false,
    });

    expect(mockDevolucionRepo.create).toHaveBeenCalledTimes(1);
    // Devolución dentro de la transacción (qr pasado al repo)
    const qr = mockQrRefs[0];
    expect(mockDevolucionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 1, registroServicioId: 10, montoDevolucion: 30000 }),
      qr,
    );
    // montoPendiente: 100000 - 30000 = 70000
    expect(mockRegistroRepo.update).toHaveBeenCalledWith(10, { montoPendiente: 70000 }, qr);
    // deudaTotal del cliente: 100000 - 30000 = 70000
    expect(qr!.manager.getRepository).toHaveBeenCalled();
    expect(mockRepoUpdate).toHaveBeenCalledWith(3, { deudaTotal: 70000 });
    // Transacción commiteada
    expect(qr!.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('persiste metodoPago (default EFECTIVO) y la caja abierta para que el arqueo la reste', async () => {
    await useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Reintegro por transferencia',
      cantidad: 1,
      montoDevolucion: 30000,
      regresaAlStock: false,
      metodoPago: 'TRANSFERENCIA' as never,
    });

    expect(mockDevolucionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ metodoPago: 'TRANSFERENCIA', cajaId: 5 }),
      expect.anything(),
    );
  });

  it('default EFECTIVO cuando no se especifica metodoPago', async () => {
    await useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Reintegro en efectivo',
      cantidad: 1,
      montoDevolucion: 30000,
      regresaAlStock: false,
    });

    expect(mockDevolucionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ metodoPago: 'EFECTIVO', cajaId: 5 }),
      expect.anything(),
    );
  });

  it('rechaza un metodoPago inválido sin persistir', async () => {
    await expect(
      useCase.execute({
        salonId: 1,
        registroServicioId: 10,
        motivo: 'Metodo inválido',
        cantidad: 1,
        montoDevolucion: 30000,
        regresaAlStock: false,
        metodoPago: 'BITCOIN' as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
  });

  it('es conservadora: nunca resta más del montoPendiente (deuda no negativa)', async () => {
    mockRegistroRepo.findById.mockResolvedValue(makeRegistro({ montoPendiente: 20000 }));
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 3, deudaTotal: 20000 });

    await useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Devolución mayor a lo pendiente',
      cantidad: 1,
      montoDevolucion: 50000,
      regresaAlStock: false,
    });

    // Solo resta lo que había pendiente: 20000 - 20000 = 0
    expect(mockRegistroRepo.update).toHaveBeenCalledWith(10, { montoPendiente: 0 }, mockQrRefs[0]);
    expect(mockRepoUpdate).toHaveBeenCalledWith(3, { deudaTotal: 0 });
  });

  it('rechaza un montoDevolucion mayor al total de la venta sin persistir', async () => {
    mockRegistroRepo.findById.mockResolvedValue(
      makeRegistro({ montoTotal: 30000, montoPendiente: 30000 }),
    );

    await expect(
      useCase.execute({
        salonId: 1,
        registroServicioId: 10,
        motivo: 'Monto excesivo',
        cantidad: 1,
        montoDevolucion: 40000,
        regresaAlStock: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
    // La transacción abierta se revierte
    expect(mockQrRefs[0]!.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('descuenta las devoluciones previas del tope de la venta', async () => {
    mockRegistroRepo.findById.mockResolvedValue(
      makeRegistro({
        montoTotal: 30000,
        montoPendiente: 30000,
        devoluciones: [{ productoId: null, cantidad: 1, montoDevolucion: 25000 }],
      }),
    );

    await expect(
      useCase.execute({
        salonId: 1,
        registroServicioId: 10,
        motivo: 'Excede lo ya devuelto',
        cantidad: 1,
        montoDevolucion: 10000,
        regresaAlStock: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza un producto que no pertenece a la venta', async () => {
    mockRegistroRepo.findById.mockResolvedValue(
      makeRegistro({ productosVendidos: [{ productoId: 8, cantidad: 1, subtotal: 5000 }] }),
    );

    await expect(
      useCase.execute({
        salonId: 1,
        registroServicioId: 10,
        motivo: 'Producto ajeno',
        cantidad: 1,
        montoDevolucion: 5000,
        regresaAlStock: true,
        productoId: 7,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
    expect(mockProductoRepo.incrementStock).not.toHaveBeenCalled();
  });

  it('rechaza cantidad mayor a la vendida en la línea de producto', async () => {
    mockRegistroRepo.findById.mockResolvedValue(
      makeRegistro({ productosVendidos: [{ productoId: 7, cantidad: 2, subtotal: 20000 }] }),
    );

    await expect(
      useCase.execute({
        salonId: 1,
        registroServicioId: 10,
        motivo: 'Cantidad excesiva',
        cantidad: 3,
        montoDevolucion: 20000,
        regresaAlStock: true,
        productoId: 7,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
    expect(mockProductoRepo.incrementStock).not.toHaveBeenCalled();
  });

  it('devuelve producto: incrementa stock y ajusta la deuda con el mismo criterio conservador', async () => {
    mockRegistroRepo.findById.mockResolvedValue(
      makeRegistro({
        productosVendidos: [{ productoId: 7, cantidad: 2, subtotal: 15000 }],
      }),
    );

    await useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Producto defectuoso',
      cantidad: 2,
      montoDevolucion: 15000,
      regresaAlStock: true,
      productoId: 7,
    });

    // Stock incrementado dentro de la transacción
    expect(mockProductoRepo.incrementStock).toHaveBeenCalledWith(7, 2, undefined, mockQrRefs[0]);
    // Deuda ajustada: 100000 - 15000 = 85000
    expect(mockRegistroRepo.update).toHaveBeenCalledWith(10, { montoPendiente: 85000 }, mockQrRefs[0]);
    expect(mockRepoUpdate).toHaveBeenCalledWith(3, { deudaTotal: 85000 });
  });

  it('devuelve dinero de un registro sin deuda (montoPendiente 0): crea la devolución sin ajustar nada', async () => {
    mockRegistroRepo.findById.mockResolvedValue(makeRegistro({ montoPendiente: 0 }));
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 3, deudaTotal: 0 });

    await useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Registro ya pagado',
      cantidad: 1,
      montoDevolucion: 30000,
      regresaAlStock: false,
    });

    expect(mockDevolucionRepo.create).toHaveBeenCalledTimes(1);
    // No hay deuda que ajustar (montoARestar = min(30000, 0) = 0)
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
    expect(mockRepoUpdate).not.toHaveBeenCalled();
  });

  it('lanza NotFoundError si el registro no existe (no persiste la devolución)', async () => {
    mockRegistroRepo.findById.mockResolvedValue(null);

    const promise = useCase.execute({
      salonId: 1,
      registroServicioId: 999,
      motivo: 'Registro inexistente',
      cantidad: 1,
      montoDevolucion: 30000,
      regresaAlStock: false,
    });

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza una devolución sobre un registro ANULADO sin reponer stock ni tocar la deuda', async () => {
    // AnularRegistroUseCase ya repuso el stock, borró las líneas de producto y
    // dejó montoPendiente/montoTotal en 0: una devolución encima duplicaría el stock.
    mockRegistroRepo.findById.mockResolvedValue(makeRegistro({ estado: 'ANULADO' }));

    const promise = useCase.execute({
      salonId: 1,
      registroServicioId: 10,
      motivo: 'Devolución sobre venta anulada',
      cantidad: 2,
      montoDevolucion: 15000,
      regresaAlStock: true,
      productoId: 7,
    });

    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityError);
    expect(mockDevolucionRepo.create).not.toHaveBeenCalled();
    expect(mockProductoRepo.incrementStock).not.toHaveBeenCalled();
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
    expect(mockRepoUpdate).not.toHaveBeenCalled();
    // La transacción se revierte
    expect(mockQrRefs[0]!.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQrRefs[0]!.commitTransaction).not.toHaveBeenCalled();
  });

  it('hace rollback si algo falla después de la transacción iniciada', async () => {
    mockDevolucionRepo.create.mockRejectedValue(new Error('DB error'));

    await expect(
      useCase.execute({
        salonId: 1,
        registroServicioId: 10,
        motivo: 'Falla de persistencia',
        cantidad: 1,
        montoDevolucion: 30000,
        regresaAlStock: false,
      }),
    ).rejects.toThrow('DB error');

    const qr = mockQrRefs[0];
    expect(qr!.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr!.commitTransaction).not.toHaveBeenCalled();
    expect(qr!.release).toHaveBeenCalledTimes(1);
  });
});

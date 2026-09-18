import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Entity mocks (avoid TypeORM decorator evaluation) ──────────
vi.mock('../../../../../../infrastructure/persistence/entities/CitaEntity.js', () => ({
  EstadoCita: {
    PENDIENTE: 'PENDIENTE',
    CONFIRMADA: 'CONFIRMADA',
    COMPLETADA: 'COMPLETADA',
    CANCELADA: 'CANCELADA',
    NO_LLEGO: 'NO_LLEGO',
  },
}));
vi.mock('../../../../../../infrastructure/persistence/entities/ClienteEntity.js', () => ({
  ClienteEntity: class ClienteEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/RegistroServicioItemEntity.js', () => ({
  RegistroServicioItemEntity: class RegistroServicioItemEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

/** Filas de item realmente persistidas vía el queryRunner compartido. */
const savedItems: Array<Record<string, unknown>> = [];
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
          create: vi.fn((data: Record<string, unknown>) => data),
          save: vi.fn(async (e: Record<string, unknown>) => {
            savedItems.push(e);
            return e;
          }),
        })),
      },
    })),
  },
}));

import { CompletarCitaUseCase } from '../CompletarCitaUseCase';
import { CreateRegistroUseCase } from '../../../../../finanzas/application/use-cases/registro/CreateRegistroUseCase';
import { ComisionService } from '../../../../../finanzas/application/services/ComisionService';
import { CostoInsumoService } from '../../../../../finanzas/application/services/CostoInsumoService';
import { EstadoCita } from '../../../../../../infrastructure/persistence/entities/CitaEntity';
import type { CreateRegistroInputConCita } from '../../../../../finanzas/application/use-cases/registro/CreateRegistroUseCase';

function citaConfirmada() {
  return {
    id: 1,
    salonId: 3,
    usuarioId: 2,
    clienteId: 1,
    fechaHora: new Date(),
    estado: EstadoCita.CONFIRMADA,
    notas: null,
    esWalkIn: false,
    citasServicios: [
      {
        citasId: 1,
        serviciosId: 1,
        cantidad: 2,
        servicio: { id: 1, nombre: 'Corte', duracionMinutos: 60, precioBase: 20000 },
      },
    ],
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };
}

function registroConItems(cantidad: number, totalServicios: number): CreateRegistroInputConCita {
  return {
    salonId: 999,
    clienteId: 1,
    usuarioId: 2,
    totalServicios,
    totalProductos: 0,
    propina: 0,
    esRetoque: false,
    divisiones: [],
    porcentajeDescuento: 0,
    productosVendidos: [],
    pagos: [{ monto: totalServicios, metodoPago: 'EFECTIVO' }],
    serviciosItems: [
      { servicioId: 1, nombreServicio: 'Corte', precioServicio: 20000, cantidad },
    ],
  };
}

describe('CompletarCitaUseCase × cantidad (integración con CreateRegistroUseCase real)', () => {
  let useCase: CompletarCitaUseCase;
  let registroRepo: { create: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let citaRepo: { findById: ReturnType<typeof vi.fn>; cambiarEstado: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    savedItems.length = 0;

    registroRepo = {
      create: vi.fn(async (data: Record<string, unknown>) => ({
        id: 99,
        ...data,
        estado: 'ACTIVO',
        estaPagadaEmpleada: false,
        pagos: [],
        divisiones: [],
        productosVendidos: [],
        serviciosItems: [],
        caja: null,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
        fechaHora: new Date(),
      })) as unknown as ReturnType<typeof vi.fn>,
      findById: vi.fn(),
    };

    const createRegistroUseCase = new CreateRegistroUseCase(
      registroRepo as never,
      { bulkCreate: vi.fn() } as never,
      { create: vi.fn() } as never,
      { findBySalonAndId: vi.fn().mockResolvedValue({ id: 1, totalServicios: 0, deudaTotal: 0 }) } as never,
      { findBySalonAndId: vi.fn().mockResolvedValue({ id: 2, porcentajeComisionServicio: '60' }) } as never,
      new ComisionService(),
      { findBySalonAndId: vi.fn(), decrementStock: vi.fn() } as never,
      { findAbiertaBySalonYFecha: vi.fn().mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' }) } as never,
      { findBySalonAndId: vi.fn().mockResolvedValue({ id: 1, tipoCostoInsumo: 'FIJO', costoBaseInsumos: 0 }) } as never,
      new CostoInsumoService(),
    );

    citaRepo = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(citaConfirmada())
        .mockResolvedValue({ ...citaConfirmada(), estado: EstadoCita.COMPLETADA }),
      cambiarEstado: vi.fn().mockResolvedValue({ ...citaConfirmada(), estado: EstadoCita.COMPLETADA }),
    };

    useCase = new CompletarCitaUseCase(
      citaRepo as never,
      { findAbiertaBySalonYFecha: vi.fn().mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' }) } as never,
      createRegistroUseCase as never,
    );
  });

  it('cantidad=2 → persiste 2 items y totalServicios=40000', async () => {
    const result = (await useCase.execute({
      id: 1,
      usuarioId: 2,
      registro: registroConItems(2, 40000),
    })) as { registro: { totalServicios: number } };

    expect(result.registro.totalServicios).toBe(40000);
    expect(registroRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalServicios: 40000, citaId: 1, salonId: 3 }),
      expect.anything(),
    );
    expect(savedItems).toHaveLength(2);
    expect(savedItems.map((i) => i.precioServicio)).toEqual([20000, 20000]);
    expect(savedItems.map((i) => i.servicioId)).toEqual([1, 1]);
  });

  it('cantidad=3 → persiste 3 items y totalServicios=60000 (triangulación)', async () => {
    const result = (await useCase.execute({
      id: 1,
      usuarioId: 2,
      registro: registroConItems(3, 60000),
    })) as { registro: { totalServicios: number } };

    expect(result.registro.totalServicios).toBe(60000);
    expect(savedItems).toHaveLength(3);
  });

  it('cantidad=1 (legacy) → 1 item y totalServicios=20000', async () => {
    const result = (await useCase.execute({
      id: 1,
      usuarioId: 2,
      registro: registroConItems(1, 20000),
    })) as { registro: { totalServicios: number } };

    expect(result.registro.totalServicios).toBe(20000);
    expect(savedItems).toHaveLength(1);
  });
});

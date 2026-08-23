import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation (patrón CreateRegistroUseCase.test.ts)
vi.mock('../../../../../../infrastructure/persistence/entities/RegistroServicioEntity.js', () => ({
  RegistroServicioEntity: class RegistroServicioEntity {},
  EstadoRegistro: { ACTIVO: 'ACTIVO', ANULADO: 'ANULADO' },
}));
vi.mock('../../../../../../infrastructure/persistence/entities/GastoEntity.js', () => ({
  GastoEntity: class GastoEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/CajaEntity.js', () => ({
  CajaEntity: class CajaEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

import { ObtenerDetalleCierreCajaUseCase } from '../ObtenerDetalleCierreCajaUseCase';
import { NotFoundError } from '../../../../../../shared/errors';

const mockCajaRepo = {
  findById: vi.fn(),
};
const mockRegistroRepo = {
  search: vi.fn(),
};
const mockGastoRepo = {
  findByCajaId: vi.fn(),
};

const cajaCerrada = {
  id: 5,
  salonId: 1,
  fechaCaja: '2026-08-15',
  montoInicial: 50000,
  montoEsperado: 135000,
  montoRealEfectivo: 160000,
  diferencia: 25000,
  estado: 'CERRADA',
  aperturaPorId: 9,
  aperturaEn: new Date('2026-08-15T13:00:00.000Z'),
  cierrePorId: 3,
  cierreEn: new Date('2026-08-15T22:00:00.000Z'),
  creadoEn: new Date('2026-08-15T13:00:00.000Z'),
};

describe('ObtenerDetalleCierreCajaUseCase', () => {
  let useCase: ObtenerDetalleCierreCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ObtenerDetalleCierreCajaUseCase(
      mockCajaRepo as never,
      mockRegistroRepo as never,
      mockGastoRepo as never,
    );
  });

  it('should devolver caja DTO + reporte + movimientos combinando registros (SERVICIO) y gastos (GASTO)', async () => {
    mockCajaRepo.findById.mockResolvedValue(cajaCerrada);
    mockRegistroRepo.search.mockResolvedValue([
      {
        id: 1,
        estado: 'ACTIVO',
        totalServicios: 150000,
        totalProductos: 10000,
        comisionCalculada: 20000,
        precioAjustado: false,
        valorOriginal: 0,
        valorFinal: 0,
        montoTotal: 160000,
        serviciosItems: [{ nombreServicio: 'Manicure' }],
        pagos: [{ monto: 100000, metodoPago: 'EFECTIVO' }],
        creadoEn: new Date('2026-08-15T14:00:00.000Z'),
      },
    ]);
    mockGastoRepo.findByCajaId.mockResolvedValue([
      { id: 9, descripcion: 'Insumos', monto: 15000, metodoPago: 'EFECTIVO', fecha: new Date('2026-08-15') },
    ]);

    const result = await useCase.execute({ salonId: 1, cajaId: 5 });

    // caja → DTO sin perder los datos del cierre
    expect(result.caja).toEqual(expect.objectContaining({ id: 5, estado: 'CERRADA', montoRealEfectivo: 160000 }));
    // reporte: fondo 50000 + EFECTIVO 100000 − gasto EFECTIVO 15000 = 135000 esperado
    expect(result.reporte.montoEsperado).toBe(135000);
    expect(result.reporte.montoReal).toBe(160000);
    expect(result.reporte.diferencia).toBe(25000);
    expect(result.reporte.porMetodoPago.EFECTIVO).toBe(100000);
    expect(result.reporte.cantidadMovimientos).toBe(2);

    // movimientos: registros como SERVICIO, gastos como GASTO
    expect(result.movimientos).toEqual([
      {
        id: 1,
        tipo: 'SERVICIO',
        fecha: new Date('2026-08-15T14:00:00.000Z'),
        descripcion: 'Manicure',
        monto: 160000,
        metodoPago: 'EFECTIVO',
      },
      {
        id: 9,
        tipo: 'GASTO',
        fecha: new Date('2026-08-15'),
        descripcion: 'Insumos',
        monto: 15000,
        metodoPago: 'EFECTIVO',
      },
    ]);
  });

  it('should devolver la fecha del movimiento desde fechaHora (backfill) con fallback a creadoEn', async () => {
    mockCajaRepo.findById.mockResolvedValue(cajaCerrada);
    // Registro backfilleado: fecha de negocio 16/08 (fechaHora) ≠ creadoEn 22/08
    mockRegistroRepo.search.mockResolvedValue([
      {
        id: 20,
        estado: 'ACTIVO',
        totalServicios: 90000,
        totalProductos: 0,
        comisionCalculada: 0,
        precioAjustado: false,
        valorOriginal: 0,
        valorFinal: 0,
        montoTotal: 90000,
        serviciosItems: [{ nombreServicio: 'Corte' }],
        pagos: [{ monto: 90000, metodoPago: 'EFECTIVO' }],
        fechaHora: new Date('2026-08-16T15:00:00.000Z'),
        creadoEn: new Date('2026-08-22T10:00:00.000Z'),
      },
      {
        id: 21,
        estado: 'ACTIVO',
        totalServicios: 10000,
        totalProductos: 0,
        comisionCalculada: 0,
        precioAjustado: false,
        valorOriginal: 0,
        valorFinal: 0,
        montoTotal: 10000,
        serviciosItems: [],
        pagos: [],
        // Legacy: sin fechaHora → fallback a creadoEn
        creadoEn: new Date('2026-08-15T14:00:00.000Z'),
      },
    ]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1, cajaId: 5 });

    expect(result.movimientos).toEqual([
      expect.objectContaining({
        id: 20,
        tipo: 'SERVICIO',
        fecha: new Date('2026-08-16T15:00:00.000Z'),
      }),
      expect.objectContaining({
        id: 21,
        tipo: 'SERVICIO',
        fecha: new Date('2026-08-15T14:00:00.000Z'),
      }),
    ]);
  });

  it('should usar "Registro #id" y metodoPago null cuando un registro no tiene items ni pagos, y excluir ANULADOS', async () => {
    mockCajaRepo.findById.mockResolvedValue(cajaCerrada);
    mockRegistroRepo.search.mockResolvedValue([
      {
        id: 7,
        estado: 'ACTIVO',
        totalServicios: 80000,
        totalProductos: 0,
        comisionCalculada: 0,
        precioAjustado: false,
        valorOriginal: 0,
        valorFinal: 0,
        montoTotal: 80000,
        serviciosItems: [],
        pagos: [],
        creadoEn: new Date('2026-08-15T15:00:00.000Z'),
      },
      {
        id: 8,
        estado: 'ANULADO',
        totalServicios: 50000,
        totalProductos: 0,
        comisionCalculada: 0,
        precioAjustado: false,
        valorOriginal: 0,
        valorFinal: 0,
        montoTotal: 50000,
        serviciosItems: [],
        pagos: [],
        creadoEn: new Date('2026-08-15T16:00:00.000Z'),
      },
    ]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1, cajaId: 5 });

    // El ANULADO no suma al reporte ni aparece en movimientos
    expect(result.reporte.cantidadMovimientos).toBe(1);
    expect(result.movimientos).toEqual([
      {
        id: 7,
        tipo: 'SERVICIO',
        fecha: new Date('2026-08-15T15:00:00.000Z'),
        descripcion: 'Registro #7',
        monto: 80000,
        metodoPago: null,
      },
    ]);
  });

  it('should devolver caja ABIERTA sin arqueo falso: montoReal null y diferencia null (no fabricar 0)', async () => {
    mockCajaRepo.findById.mockResolvedValue({
      id: 9,
      salonId: 1,
      fechaCaja: '2026-08-16',
      montoInicial: 50000,
      montoEsperado: null,
      montoRealEfectivo: null,
      diferencia: null,
      estado: 'ABIERTA',
      aperturaPorId: 2,
      aperturaEn: new Date('2026-08-16T13:00:00.000Z'),
      cierrePorId: null,
      cierreEn: null,
      creadoEn: new Date('2026-08-16T13:00:00.000Z'),
    });
    mockRegistroRepo.search.mockResolvedValue([
      {
        id: 1,
        estado: 'ACTIVO',
        totalServicios: 100000,
        totalProductos: 0,
        comisionCalculada: 0,
        precioAjustado: false,
        valorOriginal: 0,
        valorFinal: 0,
        montoTotal: 100000,
        serviciosItems: [{ nombreServicio: 'Manicure' }],
        pagos: [{ monto: 100000, metodoPago: 'EFECTIVO' }],
        creadoEn: new Date('2026-08-16T14:00:00.000Z'),
      },
    ]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1, cajaId: 9 });

    // El esperado se calcula (fondo 50000 + EFECTIVO 100000), pero al no haber
    // arqueo físico el montoReal y la diferencia deben ser null — NO 0/−esperado.
    expect(result.caja).toEqual(expect.objectContaining({ id: 9, estado: 'ABIERTA' }));
    expect(result.reporte.montoEsperado).toBe(150000);
    expect(result.reporte.montoReal).toBeNull();
    expect(result.reporte.diferencia).toBeNull();
    // La lista de movimientos sigue presente aunque la caja esté abierta
    expect(result.movimientos).toHaveLength(1);
    expect(result.movimientos[0].tipo).toBe('SERVICIO');
  });

  it('should lanzar NotFoundError cuando la caja no existe', async () => {
    mockCajaRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ salonId: 1, cajaId: 999 })).rejects.toThrow(NotFoundError);
    expect(mockRegistroRepo.search).not.toHaveBeenCalled();
    expect(mockGastoRepo.findByCajaId).not.toHaveBeenCalled();
  });

  it('should lanzar NotFoundError cuando la caja pertenece a otro salón', async () => {
    mockCajaRepo.findById.mockResolvedValue({ ...cajaCerrada, salonId: 99 });

    await expect(useCase.execute({ salonId: 1, cajaId: 5 })).rejects.toThrow(NotFoundError);
    expect(mockRegistroRepo.search).not.toHaveBeenCalled();
  });
});

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

import { ListarCierresCajaUseCase } from '../ListarCierresCajaUseCase';
import { ObtenerEsperadoCajaUseCase } from '../ObtenerEsperadoCajaUseCase';
import { CajaNoAbiertaError } from '../../../../../../shared/errors';

const mockCajaRepo = {
  listBySalonPaginated: vi.fn(),
  findAbiertaBySalonYFecha: vi.fn(),
};
const mockRegistroRepo = {
  search: vi.fn(),
};
const mockGastoRepo = {
  findByCajaId: vi.fn(),
};
const mockPagoRepo = {
  findByCajaConFallback: vi.fn(),
};

describe('ListarCierresCajaUseCase', () => {
  let useCase: ListarCierresCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListarCierresCajaUseCase(mockCajaRepo as never);
  });

  it('should devolver {data, meta} paginado de TODAS las cajas (sin estado) ordenadas por fechaCaja DESC', async () => {
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({
      data: [
        { id: 6, salonId: 1, fechaCaja: '2026-08-16', estado: 'ABIERTA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: null, cierreEn: null, montoEsperado: null, montoRealEfectivo: null, diferencia: null },
        { id: 3, salonId: 1, fechaCaja: '2026-08-15', estado: 'CERRADA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: 3, cierreEn: new Date(), montoEsperado: 100000, montoRealEfectivo: 100000, diferencia: 0 },
      ],
      total: 5,
    });

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 2 });

    // Sin estado → el repo recibe undefined (sin filtro = TODAS las cajas)
    expect(mockCajaRepo.listBySalonPaginated).toHaveBeenCalledWith(1, 1, 2, undefined);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].estado).toBe('ABIERTA');
    expect(result.data[0].fechaCaja).toBe('2026-08-16');
    expect(result.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  it('should incluir cajas ABIERTA por defecto (2 ABIERTA y 0 CERRADA → total 2)', async () => {
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({
      data: [
        { id: 6, salonId: 1, fechaCaja: '2026-08-17', estado: 'ABIERTA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: null, cierreEn: null, montoEsperado: null, montoRealEfectivo: null, diferencia: null },
        { id: 5, salonId: 1, fechaCaja: '2026-08-16', estado: 'ABIERTA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: null, cierreEn: null, montoEsperado: null, montoRealEfectivo: null, diferencia: null },
      ],
      total: 2,
    });

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 12 });

    expect(mockCajaRepo.listBySalonPaginated).toHaveBeenCalledWith(1, 1, 12, undefined);
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.data.every((c) => c.estado === 'ABIERTA')).toBe(true);
  });

  it('should filtrar por estado ABIERTA si se pasa', async () => {
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({
      data: [
        { id: 6, salonId: 1, fechaCaja: '2026-08-17', estado: 'ABIERTA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: null, cierreEn: null, montoEsperado: null, montoRealEfectivo: null, diferencia: null },
      ],
      total: 1,
    });

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0, estado: 'ABIERTA' });

    expect(mockCajaRepo.listBySalonPaginated).toHaveBeenCalledWith(1, 1, 0, 'ABIERTA');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].estado).toBe('ABIERTA');
    expect(result.meta.total).toBe(1);
  });

  it('should filtrar por estado CERRADA y contar solo las filas filtradas (2 ABIERTA + 3 CERRADA → total 3)', async () => {
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({
      data: [
        { id: 4, salonId: 1, fechaCaja: '2026-08-15', estado: 'CERRADA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: 3, cierreEn: new Date(), montoEsperado: 100000, montoRealEfectivo: 100000, diferencia: 0 },
        { id: 3, salonId: 1, fechaCaja: '2026-08-14', estado: 'CERRADA', montoInicial: 50000, aperturaPorId: 9, aperturaEn: new Date(), cierrePorId: 3, cierreEn: new Date(), montoEsperado: 90000, montoRealEfectivo: 88000, diferencia: -2000 },
      ],
      total: 3,
    });

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 12, estado: 'CERRADA' });

    expect(mockCajaRepo.listBySalonPaginated).toHaveBeenCalledWith(1, 1, 12, 'CERRADA');
    expect(result.data).toHaveLength(2);
    expect(result.data.every((c) => c.estado === 'CERRADA')).toBe(true);
    expect(result.meta.total).toBe(3);
  });
});

describe('ObtenerEsperadoCajaUseCase', () => {
  let useCase: ObtenerEsperadoCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPagoRepo.findByCajaConFallback.mockResolvedValue([]);
    useCase = new ObtenerEsperadoCajaUseCase(
      mockCajaRepo as never,
      mockRegistroRepo as never,
      mockGastoRepo as never,
      mockPagoRepo as never,
    );
  });

  it('should calcular el esperado al-vuelo sin persistir (preview arqueo)', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({
      id: 5,
      salonId: 1,
      fechaCaja: '2026-08-16',
      montoInicial: 50000,
      estado: 'ABIERTA',
      aperturaPorId: 9,
      aperturaEn: new Date(),
      cierrePorId: null,
      cierreEn: null,
      montoEsperado: null,
      montoRealEfectivo: null,
      diferencia: null,
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
      },
    ]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);
    // El dinero se cuenta por pago.cajaId (findByCajaConFallback), no por r.pagos
    mockPagoRepo.findByCajaConFallback.mockResolvedValue([{ id: 1, monto: 100000, metodoPago: 'EFECTIVO' }]);

    const result = await useCase.execute({ salonId: 1 });

    // Fondo 50000 + movimientos EFECTIVO 100000 = 150000 esperado en cajón
    expect(result.montoEsperado).toBe(150000);
    expect(result.montoReal).toBeNull();
    expect(result.diferencia).toBeNull();
    expect(mockPagoRepo.findByCajaConFallback).toHaveBeenCalledWith(5);
    // preview no debe cerrar la caja
    expect(mockCajaRepo.listBySalonPaginated).not.toHaveBeenCalled();
  });

  it('should lanzar CajaNoAbiertaError cuando no hay caja abierta', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    await expect(useCase.execute({ salonId: 1 })).rejects.toThrow(CajaNoAbiertaError);
  });
});

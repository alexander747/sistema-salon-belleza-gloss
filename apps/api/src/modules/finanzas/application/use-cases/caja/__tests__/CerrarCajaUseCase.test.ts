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

import { CerrarCajaUseCase } from '../CerrarCajaUseCase';
import { CajaNoAbiertaError, CajaYaCerradaError } from '../../../../../../shared/errors';

const mockCajaRepo = {
  findById: vi.fn(),
  findBySalonYFecha: vi.fn(),
  cerrar: vi.fn(),
};
const mockRegistroRepo = {
  search: vi.fn(),
};
const mockGastoRepo = {
  findByCajaId: vi.fn(),
};

const cajaAbierta = {
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
};

/** Huérfana: ABIERTA de un día anterior — solo se puede cerrar por cajaId. */
const cajaHuerfana = { ...cajaAbierta, id: 9 };

/** Registro ACTIVO con pagos EFECTIVO 180000 → montoEsperado 210000 (50000 inicial + 180000 − 20000 gastos). */
const registroEfectivo180k = {
  id: 1,
  estado: 'ACTIVO',
  totalServicios: 180000,
  totalProductos: 0,
  comisionCalculada: 0,
  precioAjustado: false,
  valorOriginal: 0,
  valorFinal: 0,
  pagos: [{ monto: 180000, metodoPago: 'EFECTIVO' }],
};

describe('CerrarCajaUseCase', () => {
  let useCase: CerrarCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CerrarCajaUseCase(
      mockCajaRepo as never,
      mockRegistroRepo as never,
      mockGastoRepo as never,
    );
  });

  /* ── Sin cajaId: flujo actual (caja de hoy) ── */

  it('should cerrar la caja y devolver el reporte completo (montoInicial 50000 + pagos EFECTIVO 180000 − gastos EFECTIVO 20000 = 210000)', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(cajaAbierta);
    mockRegistroRepo.search.mockResolvedValue([registroEfectivo180k]);
    mockGastoRepo.findByCajaId.mockResolvedValue([{ id: 1, monto: 20000, metodoPago: 'EFECTIVO' }]);
    mockCajaRepo.cerrar.mockResolvedValue(true);

    const result = await useCase.execute({ salonId: 1, montoRealEfectivo: 210000, cierrePorId: 3 });

    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mockCajaRepo.findById).not.toHaveBeenCalled();
    expect(mockRegistroRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 1, cajaId: 5 }),
    );
    expect(mockGastoRepo.findByCajaId).toHaveBeenCalledWith(5);
    expect(mockCajaRepo.cerrar).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        montoEsperado: 210000,
        montoRealEfectivo: 210000,
        diferencia: 0,
        cierrePorId: 3,
      }),
    );
    expect(result.reporte.montoEsperado).toBe(210000);
    expect(result.reporte.diferencia).toBe(0);
    expect(result.caja.estado).toBe('CERRADA');
  });

  it('should reportar diferencia negativa cuando el real no cuadra', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(cajaAbierta);
    mockRegistroRepo.search.mockResolvedValue([registroEfectivo180k]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);
    mockCajaRepo.cerrar.mockResolvedValue(true);

    const result = await useCase.execute({ salonId: 1, montoRealEfectivo: 225000 });

    expect(result.reporte.montoEsperado).toBe(230000);
    expect(result.reporte.diferencia).toBe(-5000);
  });

  it('should throw CajaNoAbiertaError cuando no existe caja para hoy', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(null);

    await expect(useCase.execute({ salonId: 1, montoRealEfectivo: 160000 }))
      .rejects.toThrow(CajaNoAbiertaError);
    expect(mockCajaRepo.cerrar).not.toHaveBeenCalled();
  });

  it('should throw CajaYaCerradaError cuando la caja ya está CERRADA', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue({ ...cajaAbierta, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 1, montoRealEfectivo: 160000 }))
      .rejects.toThrow(CajaYaCerradaError);
    expect(mockCajaRepo.cerrar).not.toHaveBeenCalled();
  });

  it('should throw CajaYaCerradaError cuando el update condicional no gana (race doble cierre)', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(cajaAbierta);
    mockRegistroRepo.search.mockResolvedValue([]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);
    mockCajaRepo.cerrar.mockResolvedValue(false);

    await expect(useCase.execute({ salonId: 1, montoRealEfectivo: 50000 }))
      .rejects.toThrow(CajaYaCerradaError);
  });

  /* ── Con cajaId: cierra ESA caja (huérfana de otro día) ── */

  it('should cerrar por cajaId: findById + arqueo de ESA caja (huérfana id=9) y reporte', async () => {
    mockCajaRepo.findById.mockResolvedValue(cajaHuerfana);
    mockRegistroRepo.search.mockResolvedValue([registroEfectivo180k]);
    mockGastoRepo.findByCajaId.mockResolvedValue([{ id: 1, monto: 20000, metodoPago: 'EFECTIVO' }]);
    mockCajaRepo.cerrar.mockResolvedValue(true);

    const result = await useCase.execute({ salonId: 1, montoRealEfectivo: 210000, cajaId: 9, cierrePorId: 3 });

    expect(mockCajaRepo.findById).toHaveBeenCalledWith(9);
    expect(mockCajaRepo.findBySalonYFecha).not.toHaveBeenCalled();
    expect(mockRegistroRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 1, cajaId: 9 }),
    );
    expect(mockGastoRepo.findByCajaId).toHaveBeenCalledWith(9);
    expect(mockCajaRepo.cerrar).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        montoEsperado: 210000,
        montoRealEfectivo: 210000,
        diferencia: 0,
        cierrePorId: 3,
      }),
    );
    expect(result.caja.id).toBe(9);
    expect(result.caja.estado).toBe('CERRADA');
    expect(result.reporte.montoEsperado).toBe(210000);
    expect(result.reporte.diferencia).toBe(0);
  });

  it('should throw 404 CAJA_NO_ENCONTRADA cuando cajaId no existe (findById null)', async () => {
    mockCajaRepo.findById.mockResolvedValue(null);

    const err = await useCase.execute({ salonId: 1, montoRealEfectivo: 160000, cajaId: 999 }).catch((e) => e);

    expect(err).toMatchObject({ statusCode: 404, code: 'CAJA_NO_ENCONTRADA' });
    expect(mockCajaRepo.cerrar).not.toHaveBeenCalled();
    expect(mockCajaRepo.findBySalonYFecha).not.toHaveBeenCalled();
  });

  it('should throw 404 CAJA_NO_ENCONTRADA cuando la caja es de otro salón', async () => {
    mockCajaRepo.findById.mockResolvedValue({ ...cajaHuerfana, salonId: 99 });

    const err = await useCase.execute({ salonId: 1, montoRealEfectivo: 160000, cajaId: 9 }).catch((e) => e);

    expect(err).toMatchObject({ statusCode: 404, code: 'CAJA_NO_ENCONTRADA' });
    expect(mockCajaRepo.cerrar).not.toHaveBeenCalled();
  });

  it('should throw CajaYaCerradaError cuando la caja por id ya está CERRADA', async () => {
    mockCajaRepo.findById.mockResolvedValue({ ...cajaHuerfana, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 1, montoRealEfectivo: 160000, cajaId: 9 }))
      .rejects.toThrow(CajaYaCerradaError);
    expect(mockCajaRepo.cerrar).not.toHaveBeenCalled();
    expect(mockCajaRepo.findBySalonYFecha).not.toHaveBeenCalled();
  });

  it('should throw CajaYaCerradaError en race de doble cierre por id (cerrar false)', async () => {
    mockCajaRepo.findById.mockResolvedValue(cajaHuerfana);
    mockRegistroRepo.search.mockResolvedValue([]);
    mockGastoRepo.findByCajaId.mockResolvedValue([]);
    mockCajaRepo.cerrar.mockResolvedValue(false);

    await expect(useCase.execute({ salonId: 1, montoRealEfectivo: 50000, cajaId: 9 }))
      .rejects.toThrow(CajaYaCerradaError);
    expect(mockCajaRepo.cerrar).toHaveBeenCalledWith(9, expect.anything());
  });
});

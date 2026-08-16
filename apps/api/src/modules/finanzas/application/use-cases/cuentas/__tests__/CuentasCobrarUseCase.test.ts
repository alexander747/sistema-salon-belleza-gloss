import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CuentasCobrarUseCase } from '../CuentasCobrarUseCase';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

// ── Fakes ─────────────────────────────────────────────────────
const mockRegistroRepo = {
  findConDeudaBySalon: vi.fn(),
};

// Fecha fija "hoy" en hora Colombia (UTC-5): 2026-08-16 12:00 COT
const HOY = new Date('2026-08-16T12:00:00-05:00');

const makeRegistro = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  salonId: 1,
  clienteId: 1,
  estado: EstadoRegistro.ACTIVO,
  montoPendiente: 0,
  creadoEn: new Date('2026-08-10T10:00:00-05:00'),
  cliente: { id: 1, nombre: 'Ana' },
  ...overrides,
});

describe('CuentasCobrarUseCase', () => {
  let useCase: CuentasCobrarUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(HOY);
    useCase = new CuentasCobrarUseCase(mockRegistroRepo as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrega deuda por cliente: suma montoPendiente, excluye anulados y cero, antigüedad desde el registro más antiguo', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([
      makeRegistro({ id: 1, clienteId: 1, montoPendiente: 15000, creadoEn: new Date('2026-08-10T10:00:00-05:00') }),
      makeRegistro({ id: 2, clienteId: 1, montoPendiente: 25000, creadoEn: new Date('2026-07-01T10:00:00-05:00') }),
      // Anulado: no debe sumar
      makeRegistro({ id: 3, clienteId: 1, estado: EstadoRegistro.ANULADO, montoPendiente: 30000 }),
      // Deuda 0: no debe contar
      makeRegistro({ id: 4, clienteId: 1, montoPendiente: 0 }),
      // Cliente B con deuda 0: no debe aparecer
      makeRegistro({ id: 5, clienteId: 2, montoPendiente: 0, cliente: { id: 2, nombre: 'Bety' } }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(mockRegistroRepo.findConDeudaBySalon).toHaveBeenCalledWith(1);
    expect(result.meta).toEqual({ page: 1, limit: 0, total: 1, totalPages: 1 });
    expect(result.data).toEqual([
      {
        clienteId: 1,
        nombre: 'Ana',
        deudaTotal: 40000,
        cantidadRegistros: 2,
        antiguedadDias: 46,
        antiguedadBucket: '31-60',
      },
    ]);
  });

  it('ordena por deudaTotal DESC y pagina (spec: 25 clientes, primera "Ana")', async () => {
    const registros = Array.from({ length: 25 }, (_, i) => {
      const id = i + 1;
      return makeRegistro({
        id,
        clienteId: id,
        montoPendiente: id * 1000,
        cliente: { id, nombre: id === 25 ? 'Ana' : `Cliente ${id}` },
        creadoEn: new Date('2026-08-10T10:00:00-05:00'),
      });
    });
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue(registros);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 10 });

    expect(result.meta).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(result.data).toHaveLength(10);
    expect(result.data[0].nombre).toBe('Ana');
    expect(result.data[0].deudaTotal).toBe(25000);
    // Orden descendente estricto
    for (let i = 1; i < result.data.length; i += 1) {
      expect(result.data[i].deudaTotal).toBeLessThan(result.data[i - 1].deudaTotal);
    }
  });

  it('devuelve la última página con el resto de filas', async () => {
    const registros = Array.from({ length: 25 }, (_, i) => {
      const id = i + 1;
      return makeRegistro({
        id,
        clienteId: id,
        montoPendiente: id * 1000,
        cliente: { id, nombre: `Cliente ${id}` },
      });
    });
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue(registros);

    const result = await useCase.execute({ salonId: 1, page: 3, limit: 10 });

    expect(result.data).toHaveLength(5);
    expect(result.data[0].deudaTotal).toBe(5000);
  });

  it('clasifica buckets de antigüedad: 0-30, 31-60, 61-90 y 90+ con el límite de 90 días', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([
      makeRegistro({ id: 1, clienteId: 1, montoPendiente: 1000, creadoEn: new Date('2026-08-06T10:00:00-05:00'), cliente: { id: 1, nombre: 'Diez' } }),
      makeRegistro({ id: 2, clienteId: 2, montoPendiente: 2000, creadoEn: new Date('2026-07-02T10:00:00-05:00'), cliente: { id: 2, nombre: 'Cuarenta' } }),
      makeRegistro({ id: 3, clienteId: 3, montoPendiente: 3000, creadoEn: new Date('2026-05-18T10:00:00-05:00'), cliente: { id: 3, nombre: 'Noventa' } }),
      makeRegistro({ id: 4, clienteId: 4, montoPendiente: 4000, creadoEn: new Date('2026-06-02T10:00:00-05:00'), cliente: { id: 4, nombre: 'Setenta' } }),
      makeRegistro({ id: 5, clienteId: 5, montoPendiente: 5000, creadoEn: new Date('2026-04-18T10:00:00-05:00'), cliente: { id: 5, nombre: 'CientoVeinte' } }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });
    const porNombre = Object.fromEntries(result.data.map((f) => [f.nombre, f]));

    expect(porNombre['Diez']).toMatchObject({ antiguedadDias: 10, antiguedadBucket: '0-30' });
    expect(porNombre['Cuarenta']).toMatchObject({ antiguedadDias: 45, antiguedadBucket: '31-60' });
    expect(porNombre['Noventa']).toMatchObject({ antiguedadDias: 90, antiguedadBucket: '61-90' });
    expect(porNombre['Setenta']).toMatchObject({ antiguedadDias: 75, antiguedadBucket: '61-90' });
    expect(porNombre['CientoVeinte']).toMatchObject({ antiguedadDias: 120, antiguedadBucket: '90+' });
  });

  it('devuelve lista vacía cuando el salón no tiene registros con deuda', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 10 });

    expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(result.data).toEqual([]);
  });
});

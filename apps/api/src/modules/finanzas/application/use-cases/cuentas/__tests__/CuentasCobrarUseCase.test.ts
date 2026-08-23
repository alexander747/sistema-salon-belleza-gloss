import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CuentasCobrarUseCase } from '../CuentasCobrarUseCase';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

// ── Fakes ─────────────────────────────────────────────────────
const mockRegistroRepo = {
  findConDeudaBySalon: vi.fn(),
};

const mockPrestamoRepo = {
  findBySalon: vi.fn(),
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

const makePrestamo = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  salonId: 1,
  usuarioId: 5,
  usuario: { id: 5, nombre: 'Eder' },
  nombreTercero: null,
  monto: 100000,
  saldoPendiente: 50000,
  motivo: 'Préstamo',
  estado: 'ACTIVO',
  fechaCreacion: new Date('2026-08-10T00:00:00-05:00'),
  ...overrides,
});

describe('CuentasCobrarUseCase', () => {
  let useCase: CuentasCobrarUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: salón sin préstamos activos (los tests de clientes no dependen de ello)
    mockPrestamoRepo.findBySalon.mockResolvedValue([[], 0]);
    vi.useFakeTimers();
    vi.setSystemTime(HOY);
    useCase = new CuentasCobrarUseCase(mockRegistroRepo as never, mockPrestamoRepo as never);
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
    expect(mockPrestamoRepo.findBySalon).toHaveBeenCalledWith({ salonId: 1, estado: 'ACTIVO' });
    expect(result.meta).toEqual({ page: 1, limit: 0, total: 1, totalPages: 1 });
    expect(result.data).toEqual([
      {
        id: 1,
        tipo: 'CLIENTE',
        nombre: 'Ana',
        deudaTotal: 40000,
        cantidadRegistros: 2,
        antiguedadDias: 46,
        antiguedadBucket: '31-60',
      },
    ]);
  });

  it('computa la antigüedad desde fechaHora (backfill) con fallback a creadoEn', async () => {
    // Registro backfilleado: fecha de negocio 01/07 pero creadoEn 10/08 → la
    // deuda envejece desde la FECHA DE NEGOCIO (46 días), no desde creadoEn (6).
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([
      makeRegistro({
        id: 1,
        clienteId: 1,
        montoPendiente: 15000,
        fechaHora: new Date('2026-07-01T10:00:00-05:00'),
        creadoEn: new Date('2026-08-10T10:00:00-05:00'),
        cliente: { id: 1, nombre: 'Ana' },
      }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data[0]).toMatchObject({ nombre: 'Ana', antiguedadDias: 46, antiguedadBucket: '31-60' });
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

    expect(mockPrestamoRepo.findBySalon).toHaveBeenCalledWith({ salonId: 1, estado: 'ACTIVO' });
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(result.data).toEqual([]);
  });

  // ── Préstamos activos en cuentas por cobrar ──────────────────

  it('incluye préstamos ACTIVOS con saldoPendiente > 0 como filas tipo PRESTAMO', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([]);
    mockPrestamoRepo.findBySalon.mockResolvedValue([
      [makePrestamo({ id: 10, saldoPendiente: 50000, usuario: { id: 5, nombre: 'Eder' } })],
      1,
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toEqual([
      {
        id: 10,
        tipo: 'PRESTAMO',
        nombre: 'Eder',
        deudaTotal: 50000,
        cantidadRegistros: null,
        antiguedadDias: 6,
        antiguedadBucket: '0-30',
      },
    ]);
  });

  it('usa nombreTercero cuando el préstamo no tiene usuario vinculado', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([]);
    mockPrestamoRepo.findBySalon.mockResolvedValue([
      [makePrestamo({ id: 11, usuarioId: null, usuario: null, nombreTercero: 'Fulanito', saldoPendiente: 30000 })],
      1,
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toEqual([
      expect.objectContaining({ id: 11, tipo: 'PRESTAMO', nombre: 'Fulanito', deudaTotal: 30000 }),
    ]);
  });

  it('excluye préstamos PAGADO, CANCELADO y con saldoPendiente 0', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([]);
    mockPrestamoRepo.findBySalon.mockResolvedValue([
      [
        makePrestamo({ id: 20, estado: 'PAGADO', saldoPendiente: 0 }),
        makePrestamo({ id: 21, estado: 'CANCELADO', saldoPendiente: 90000 }),
        makePrestamo({ id: 22, estado: 'ACTIVO', saldoPendiente: 0 }),
      ],
      3,
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toEqual([]);
  });

  it('une clientes y préstamos en una sola lista ordenada por deudaTotal DESC', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([
      makeRegistro({ id: 1, clienteId: 1, montoPendiente: 40000, cliente: { id: 1, nombre: 'Ana' } }),
    ]);
    mockPrestamoRepo.findBySalon.mockResolvedValue([
      [
        makePrestamo({ id: 30, saldoPendiente: 90000, usuario: { id: 5, nombre: 'Eder' } }),
        makePrestamo({ id: 31, saldoPendiente: 10000, usuario: { id: 6, nombre: 'Bety' } }),
      ],
      2,
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toHaveLength(3);
    expect(result.data.map((f) => [f.id, f.tipo, f.deudaTotal])).toEqual([
      [30, 'PRESTAMO', 90000],
      [1, 'CLIENTE', 40000],
      [31, 'PRESTAMO', 10000],
    ]);
  });

  it('aplica paginación sobre la lista unificada de clientes y préstamos', async () => {
    mockRegistroRepo.findConDeudaBySalon.mockResolvedValue([
      makeRegistro({ id: 1, clienteId: 1, montoPendiente: 40000, cliente: { id: 1, nombre: 'Ana' } }),
    ]);
    mockPrestamoRepo.findBySalon.mockResolvedValue([
      [
        makePrestamo({ id: 30, saldoPendiente: 90000, usuario: { id: 5, nombre: 'Eder' } }),
        makePrestamo({ id: 31, saldoPendiente: 10000, usuario: { id: 6, nombre: 'Bety' } }),
      ],
      2,
    ]);

    const result = await useCase.execute({ salonId: 1, page: 2, limit: 2 });

    expect(result.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 31, tipo: 'PRESTAMO' });
  });
});

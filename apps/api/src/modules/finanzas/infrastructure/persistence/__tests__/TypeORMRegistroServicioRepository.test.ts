import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRawOne = vi.fn();
const mockGetRawMany = vi.fn();
const mockFind = vi.fn();
const mockGetCount = vi.fn();
const mockGetMany = vi.fn();

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  addSelect: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  leftJoinAndSelect: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  getRawOne: ReturnType<typeof vi.fn>;
  getRawMany: ReturnType<typeof vi.fn>;
  getCount: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
}

const mockQueryBuilder = {
  select: vi.fn(() => mockQueryBuilder),
  addSelect: vi.fn(() => mockQueryBuilder),
  innerJoin: vi.fn(() => mockQueryBuilder),
  leftJoin: vi.fn(() => mockQueryBuilder),
  leftJoinAndSelect: vi.fn(() => mockQueryBuilder),
  where: vi.fn(() => mockQueryBuilder),
  andWhere: vi.fn(() => mockQueryBuilder),
  groupBy: vi.fn(() => mockQueryBuilder),
  orderBy: vi.fn(() => mockQueryBuilder),
  skip: vi.fn(() => mockQueryBuilder),
  take: vi.fn(() => mockQueryBuilder),
  getRawOne: mockGetRawOne,
  getRawMany: mockGetRawMany,
  getCount: mockGetCount,
  getMany: mockGetMany,
} as unknown as MockQueryBuilder;

vi.mock('../../../../../shared/database', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({
      createQueryBuilder: vi.fn(() => mockQueryBuilder),
      find: mockFind,
    })),
  },
}));

vi.mock('../../../../../infrastructure/persistence/entities/RegistroServicioEntity.js', () => ({
  RegistroServicioEntity: class RegistroServicioEntity {},
  EstadoRegistro: { ACTIVO: 'ACTIVO', ANULADO: 'ANULADO' },
}));

import { TypeORMRegistroServicioRepository } from '../TypeORMRegistroServicioRepository';

describe('TypeORMRegistroServicioRepository.sumPagosPorPeriodo', () => {
  let repo: TypeORMRegistroServicioRepository;

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockGetRawOne.mockReset();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.innerJoin.mockClear();
    mockQueryBuilder.leftJoin.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
  });

  it('suma los pagos recibidos en el período, solo de registros NO ANULADO del salón (fecha de negocio = caja del pago)', async () => {
    mockGetRawOne.mockResolvedValue({ total: '350000.00' });

    const inicio = new Date('2026-05-01T05:00:00.000Z');
    const fin = new Date('2026-06-01T05:00:00.000Z');

    const result = await repo.sumPagosPorPeriodo(1, inicio, fin);

    expect(result).toBe(350000);
    // SQL: SUM(p.monto) con alias 'total', unión a pagos_transaccion + caja del pago
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('COALESCE(SUM(p.monto), 0)', 'total');
    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('r.pagos', 'p');
    expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('p.caja', 'pc');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.estado != :anulado', {
      anulado: 'ANULADO',
    });
    // La fecha de negocio del pago es la de su CAJA (pago.cajaId → caja.fechaCaja,
    // DATE puro); p.creadoEn es el momento de carga (backfill: hoy ≠ fecha real).
    // Legacy sin caja cae al registro (COALESCE fechaHora, creadoEn). El rango se
    // compara como fecha Colombia pura para evitar el desfase de las 05:00 UTC.
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d')) >= :fechaInicioStr",
      { fechaInicioStr: '2026-05-01' },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d')) < :fechaFinStr",
      { fechaFinStr: '2026-06-01' },
    );
  });

  it('filtra por empleada (r.usuarioId) cuando se pasa usuarioId', async () => {
    mockGetRawOne.mockResolvedValue({ total: '50000.00' });

    const inicio = new Date('2026-05-01T05:00:00.000Z');
    const fin = new Date('2026-06-01T05:00:00.000Z');

    const result = await repo.sumPagosPorPeriodo(1, inicio, fin, 4);

    expect(result).toBe(50000);
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.usuarioId = :usuarioId', {
      usuarioId: 4,
    });
  });

  it('devuelve 0 cuando no hay pagos en el período (SUM NULL)', async () => {
    mockGetRawOne.mockResolvedValue({ total: null });

    const result = await repo.sumPagosPorPeriodo(
      2,
      new Date('2026-01-01T05:00:00.000Z'),
      new Date('2026-02-01T05:00:00.000Z'),
    );

    expect(result).toBe(0);
  });
});

// PR6a — cobros de DEUDA ANTERIOR: pagos recibidos en el período cuya venta
// original (fecha de negocio del REGISTRO) es previa al inicio del período.
describe('TypeORMRegistroServicioRepository.sumCobrosDeudaAnterior', () => {
  let repo: TypeORMRegistroServicioRepository;

  const PAGO_SQL =
    "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d'))";

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockGetRawOne.mockReset();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.innerJoin.mockClear();
    mockQueryBuilder.leftJoin.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
  });

  it('suma los pagos del período cuyo registro es ANTERIOR al inicio (deuda vieja), excluye ANULADO', async () => {
    mockGetRawOne.mockResolvedValue({ total: '20000.00' });

    const inicio = new Date('2026-05-01T05:00:00.000Z');
    const fin = new Date('2026-06-01T05:00:00.000Z');

    const result = await repo.sumCobrosDeudaAnterior(1, inicio, fin);

    expect(result).toBe(20000);
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('COALESCE(SUM(p.monto), 0)', 'total');
    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('r.pagos', 'p');
    expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('p.caja', 'pc');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.estado != :anulado', {
      anulado: 'ANULADO',
    });
    // Ventana del PAGO: misma "fecha de negocio del pago" que sumPagosPorPeriodo.
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(`${PAGO_SQL} >= :fechaInicioStr`, {
      fechaInicioStr: '2026-05-01',
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(`${PAGO_SQL} < :fechaFinStr`, {
      fechaFinStr: '2026-06-01',
    });
    // "Anterior": fecha de negocio del REGISTRO (sin caja del pago) < inicio.
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "DATE_FORMAT(COALESCE(r.fechaHora, r.creadoEn), '%Y-%m-%d') < :fechaRegistroAnteriorStr",
      { fechaRegistroAnteriorStr: '2026-05-01' },
    );
  });

  it('respeta los filtros usuarioId y clienteId', async () => {
    mockGetRawOne.mockResolvedValue({ total: '5000.00' });

    const result = await repo.sumCobrosDeudaAnterior(
      1,
      new Date('2026-05-01T05:00:00.000Z'),
      new Date('2026-06-01T05:00:00.000Z'),
      4,
      7,
    );

    expect(result).toBe(5000);
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.usuarioId = :usuarioId', {
      usuarioId: 4,
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.clienteId = :clienteId', {
      clienteId: 7,
    });
  });

  it('devuelve 0 cuando no hay cobros de deuda anterior (SUM NULL)', async () => {
    mockGetRawOne.mockResolvedValue({ total: null });

    const result = await repo.sumCobrosDeudaAnterior(
      2,
      new Date('2026-01-01T05:00:00.000Z'),
      new Date('2026-02-01T05:00:00.000Z'),
    );

    expect(result).toBe(0);
  });
});

describe('TypeORMRegistroServicioRepository.sumMontoPendientePorPeriodo', () => {
  let repo: TypeORMRegistroServicioRepository;

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockGetRawOne.mockReset();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
  });

  it('suma el montoPendiente de registros NO ANULADO del salón cuya fecha de negocio cae en el período (fiado originado)', async () => {
    mockGetRawOne.mockResolvedValue({ total: '100000.00' });

    const inicio = new Date('2026-05-01T05:00:00.000Z');
    const fin = new Date('2026-06-01T05:00:00.000Z');

    const result = await repo.sumMontoPendientePorPeriodo(1, inicio, fin);

    expect(result).toBe(100000);
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('COALESCE(SUM(r.montoPendiente), 0)', 'total');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.estado != :anulado', {
      anulado: 'ANULADO',
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'COALESCE(r.fechaHora, r.creadoEn) >= :fechaInicio',
      { fechaInicio: inicio },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'COALESCE(r.fechaHora, r.creadoEn) < :fechaFin',
      { fechaFin: fin },
    );
  });

  it('devuelve 0 cuando no hay registros fiados en el período (SUM NULL)', async () => {
    mockGetRawOne.mockResolvedValue({ total: null });

    const result = await repo.sumMontoPendientePorPeriodo(
      2,
      new Date('2026-01-01T05:00:00.000Z'),
      new Date('2026-02-01T05:00:00.000Z'),
    );

    expect(result).toBe(0);
  });
});

describe('TypeORMRegistroServicioRepository.sumMontoPendienteHasta', () => {
  let repo: TypeORMRegistroServicioRepository;

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockGetRawOne.mockReset();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
  });

  it('suma el montoPendiente acumulado de registros NO ANULADO con fecha de negocio <= hasta (deudas por cobrar)', async () => {
    mockGetRawOne.mockResolvedValue({ total: '50000.00' });

    const hasta = new Date('2026-07-01T05:00:00.000Z');

    const result = await repo.sumMontoPendienteHasta(1, hasta);

    expect(result).toBe(50000);
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('COALESCE(SUM(r.montoPendiente), 0)', 'total');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.estado != :anulado', {
      anulado: 'ANULADO',
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'COALESCE(r.fechaHora, r.creadoEn) <= :hasta',
      { hasta },
    );
  });

  it('devuelve 0 sin registros con deuda (SUM NULL)', async () => {
    mockGetRawOne.mockResolvedValue({ total: null });

    const result = await repo.sumMontoPendienteHasta(2, new Date('2026-07-01T05:00:00.000Z'));

    expect(result).toBe(0);
  });
});

describe('TypeORMRegistroServicioRepository.sumPagosPorMes', () => {
  let repo: TypeORMRegistroServicioRepository;

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockGetRawMany.mockReset();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.addSelect.mockClear();
    mockQueryBuilder.innerJoin.mockClear();
    mockQueryBuilder.leftJoin.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
    mockQueryBuilder.groupBy.mockClear();
    mockQueryBuilder.orderBy.mockClear();
  });

  it('agrupa los pagos por mes (fecha de negocio = caja del pago), solo registros NO ANULADO del salón', async () => {
    mockGetRawMany.mockResolvedValue([
      { mes: '2026-07', total: '1500000.00' },
      { mes: '2026-08', total: '2295000.00' },
    ]);

    const inicio = new Date('2026-03-01T05:00:00.000Z');
    const fin = new Date('2026-10-01T05:00:00.000Z');

    const result = await repo.sumPagosPorMes(1, inicio, fin);

    expect(result).toEqual([
      { mes: '2026-07', total: 1500000 },
      { mes: '2026-08', total: 2295000 },
    ]);
    // Misma fecha de negocio que sumPagosPorPeriodo: COALESCE(caja del pago,
    // fechaHora, creadoEn) del registro, comparada como fecha Colombia pura.
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.estado != :anulado', {
      anulado: 'ANULADO',
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d')) >= :fechaInicioStr",
      { fechaInicioStr: '2026-03-01' },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d')) < :fechaFinStr",
      { fechaFinStr: '2026-10-01' },
    );
    // Agrupación por mes del mismo COALESCE, ordenado ascendente
    expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith(
      "SUBSTRING(COALESCE(DATE_FORMAT(pc.fechaCaja, '%Y-%m-%d'), DATE_FORMAT(r.fechaHora, '%Y-%m-%d'), DATE_FORMAT(r.creadoEn, '%Y-%m-%d')), 1, 7)",
    );
    expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('mes', 'ASC');
  });

  it('devuelve [] cuando no hay pagos en el rango (sin filas que agrupar)', async () => {
    mockGetRawMany.mockResolvedValue([]);

    const result = await repo.sumPagosPorMes(
      2,
      new Date('2026-01-01T05:00:00.000Z'),
      new Date('2026-02-01T05:00:00.000Z'),
    );

    expect(result).toEqual([]);
  });
});

// Regresión B-1 (PR4): la nómina suma `serviciosItems[].costoBaseInsumos` sobre los
// registros que devuelve `findBySalon`. Si la relación no se carga, el total es
// siempre 0. Este test fija el contrato de la consulta en el borde del repositorio.
describe('TypeORMRegistroServicioRepository.findBySalon', () => {
  let repo: TypeORMRegistroServicioRepository;

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockFind.mockReset();
  });

  it('carga la relación serviciosItems además de pagos y divisiones', async () => {
    mockFind.mockResolvedValue([]);

    await repo.findBySalon(7);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salonId: 7 },
        relations: expect.arrayContaining(['pagos', 'divisiones', 'serviciosItems']),
      }),
    );
  });

  it('conserva el filtro por salonId y el orden por creadoEn DESC al agregar la relación', async () => {
    mockFind.mockResolvedValue([]);

    await repo.findBySalon(42);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salonId: 42 },
        order: { creadoEn: 'DESC' },
      }),
    );
  });
});

// Fix de paginación (PR5): `search` y `count` deben aplicar EXACTAMENTE los mismos
// criterios de estado/tipo. Antes ninguno filtraba y el frontend filtraba client-side,
// con lo que `meta.total` (server) y las filas renderizadas no coincidían.
describe('TypeORMRegistroServicioRepository.search/count — filtros estado y tipo', () => {
  let repo: TypeORMRegistroServicioRepository;

  const desde = new Date('2026-09-04T05:00:00.000Z');
  const hasta = new Date('2026-09-30T04:59:59.000Z');

  const estadoClauses = () =>
    mockQueryBuilder.andWhere.mock.calls.filter(([sql]) => String(sql).includes('r.estado'));
  const tipoClauses = () =>
    mockQueryBuilder.andWhere.mock.calls.filter(
      ([sql]) => String(sql).includes('totalServicios') || String(sql).includes('totalProductos'),
    );

  beforeEach(() => {
    repo = new TypeORMRegistroServicioRepository();
    mockGetCount.mockReset();
    mockGetMany.mockReset();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
    mockQueryBuilder.skip.mockClear();
    mockQueryBuilder.take.mockClear();
  });

  it('count con estado=ACTIVOS excluye ANULADO', async () => {
    mockGetCount.mockResolvedValue(15);

    const result = await repo.count({ salonId: 1, desde, hasta, estado: 'ACTIVOS' });

    expect(result).toBe(15);
    expect(estadoClauses()).toContainEqual(['r.estado != :anulado', { anulado: 'ANULADO' }]);
    expect(estadoClauses().some(([sql]) => String(sql) === 'r.estado = :anulado')).toBe(false);
  });

  it('count con estado=ANULADOS deja solo los ANULADO', async () => {
    mockGetCount.mockResolvedValue(11);

    const result = await repo.count({ salonId: 1, desde, hasta, estado: 'ANULADOS' });

    expect(result).toBe(11);
    expect(estadoClauses()).toContainEqual(['r.estado = :anulado', { anulado: 'ANULADO' }]);
  });

  it('count con estado=TODOS (y con estado ausente) no agrega cláusula de estado', async () => {
    mockGetCount.mockResolvedValue(26);

    await repo.count({ salonId: 1, desde, hasta, estado: 'TODOS' });
    expect(estadoClauses()).toHaveLength(0);

    mockQueryBuilder.andWhere.mockClear();
    await repo.count({ salonId: 1, desde, hasta });
    expect(estadoClauses()).toHaveLength(0);
  });

  it('count filtra por tipo: SERVICIOS → totalServicios > 0, PRODUCTOS → totalProductos > 0', async () => {
    mockGetCount.mockResolvedValue(25);

    await repo.count({ salonId: 1, desde, hasta, tipo: 'SERVICIOS' });
    expect(tipoClauses()).toContainEqual(['r.totalServicios > 0']);

    mockQueryBuilder.andWhere.mockClear();
    await repo.count({ salonId: 1, desde, hasta, tipo: 'PRODUCTOS' });
    expect(tipoClauses()).toContainEqual(['r.totalProductos > 0']);

    mockQueryBuilder.andWhere.mockClear();
    await repo.count({ salonId: 1, desde, hasta, tipo: 'TODOS' });
    expect(tipoClauses()).toHaveLength(0);
  });

  it('search y count aplican criterios idénticos para los mismos params (sin divergencia)', async () => {
    mockGetMany.mockResolvedValue([]);
    mockGetCount.mockResolvedValue(15);

    const params = { salonId: 1, desde, hasta, estado: 'ACTIVOS' as const, tipo: 'SERVICIOS' as const };

    await repo.search({ ...params, skip: 0, take: 12 });
    const searchClauses = [...mockQueryBuilder.andWhere.mock.calls];

    mockQueryBuilder.andWhere.mockClear();

    await repo.count(params);
    const countClauses = [...mockQueryBuilder.andWhere.mock.calls];

    expect(countClauses).toEqual(searchClauses);
    expect(searchClauses.length).toBeGreaterThan(0);
    // El contrato cubre estado + tipo (además del rango de fechas del fixture).
    expect(searchClauses).toContainEqual(['r.estado != :anulado', { anulado: 'ANULADO' }]);
    expect(searchClauses).toContainEqual(['r.totalServicios > 0']);
  });
});

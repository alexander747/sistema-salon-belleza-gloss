import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRawOne = vi.fn();
const mockGetRawMany = vi.fn();

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  addSelect: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  getRawOne: ReturnType<typeof vi.fn>;
  getRawMany: ReturnType<typeof vi.fn>;
}

const mockQueryBuilder = {
  select: vi.fn(() => mockQueryBuilder),
  addSelect: vi.fn(() => mockQueryBuilder),
  innerJoin: vi.fn(() => mockQueryBuilder),
  leftJoin: vi.fn(() => mockQueryBuilder),
  where: vi.fn(() => mockQueryBuilder),
  andWhere: vi.fn(() => mockQueryBuilder),
  groupBy: vi.fn(() => mockQueryBuilder),
  orderBy: vi.fn(() => mockQueryBuilder),
  getRawOne: mockGetRawOne,
  getRawMany: mockGetRawMany,
} as unknown as MockQueryBuilder;

vi.mock('../../../../../shared/database', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({
      createQueryBuilder: vi.fn(() => mockQueryBuilder),
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

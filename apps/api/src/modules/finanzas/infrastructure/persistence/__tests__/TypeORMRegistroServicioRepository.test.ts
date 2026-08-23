import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRawOne = vi.fn();

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  getRawOne: ReturnType<typeof vi.fn>;
}

const mockQueryBuilder = {
  select: vi.fn(() => mockQueryBuilder),
  innerJoin: vi.fn(() => mockQueryBuilder),
  where: vi.fn(() => mockQueryBuilder),
  andWhere: vi.fn(() => mockQueryBuilder),
  getRawOne: mockGetRawOne,
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
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
  });

  it('suma los pagos recibidos en el período, solo de registros NO ANULADO del salón (fecha de recepción = pago.creadoEn)', async () => {
    mockGetRawOne.mockResolvedValue({ total: '350000.00' });

    const inicio = new Date('2026-05-01T05:00:00.000Z');
    const fin = new Date('2026-06-01T05:00:00.000Z');

    const result = await repo.sumPagosPorPeriodo(1, inicio, fin);

    expect(result).toBe(350000);
    // SQL: SUM(p.monto) con alias 'total', unión a pagos_transaccion
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('COALESCE(SUM(p.monto), 0)', 'total');
    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('r.pagos', 'p');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.estado != :anulado', {
      anulado: 'ANULADO',
    });
    // La fecha de recepción del dinero es p.creadoEn (abono = momento del abono)
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p.creadoEn >= :fechaInicio', {
      fechaInicio: inicio,
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p.creadoEn < :fechaFin', {
      fechaFin: fin,
    });
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

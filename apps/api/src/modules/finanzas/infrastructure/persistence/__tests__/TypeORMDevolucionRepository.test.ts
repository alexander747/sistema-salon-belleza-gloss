import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRawOne = vi.fn();

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  getRawOne: ReturnType<typeof vi.fn>;
}

const mockQueryBuilder = {
  select: vi.fn(() => mockQueryBuilder),
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

import { TypeORMDevolucionRepository } from '../TypeORMDevolucionRepository';

describe('TypeORMDevolucionRepository.sumBySalonAndDateRange', () => {
  let repo: TypeORMDevolucionRepository;

  beforeEach(() => {
    repo = new TypeORMDevolucionRepository();
    mockGetRawOne.mockReset();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
  });

  it('suma montoDevolucion dentro del rango [desde, hasta) y devuelve el total como número', async () => {
    mockGetRawOne.mockResolvedValue({ total: '45000.00' });

    const desde = new Date('2026-05-01T05:00:00.000Z');
    const hasta = new Date('2026-06-01T05:00:00.000Z');

    const result = await repo.sumBySalonAndDateRange(1, desde, hasta);

    expect(result).toBe(45000);
    // SQL wiring: filtra por salon y por creadoEn (semirrango abierto)
    expect(mockQueryBuilder.select).toHaveBeenCalledWith(
      'COALESCE(SUM(d.montoDevolucion), 0)',
      'total',
    );
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('d.salonId = :salonId', { salonId: 1 });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('d.creadoEn >= :fechaInicio', {
      fechaInicio: desde,
    });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('d.creadoEn < :fechaFin', {
      fechaFin: hasta,
    });
  });

  it('devuelve 0 cuando no hay devoluciones en el rango (SUM NULL)', async () => {
    mockGetRawOne.mockResolvedValue({ total: null });

    const result = await repo.sumBySalonAndDateRange(
      2,
      new Date('2026-01-01T05:00:00.000Z'),
      new Date('2026-02-01T05:00:00.000Z'),
    );

    expect(result).toBe(0);
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetMany = vi.fn();

interface MockQueryBuilder {
  leftJoinAndSelect: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orWhere: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
}

const mockQueryBuilder = {
  leftJoinAndSelect: vi.fn(() => mockQueryBuilder),
  where: vi.fn(() => mockQueryBuilder),
  andWhere: vi.fn(() => mockQueryBuilder),
  orWhere: vi.fn(() => mockQueryBuilder),
  getMany: mockGetMany,
} as unknown as MockQueryBuilder;

vi.mock('../../../../../shared/database', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({
      createQueryBuilder: vi.fn(() => mockQueryBuilder),
    })),
  },
}));

vi.mock('../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  PagoTransaccionEntity: class PagoTransaccionEntity {},
}));
vi.mock('../../../../../infrastructure/persistence/entities/RegistroServicioEntity.js', () => ({
  RegistroServicioEntity: class RegistroServicioEntity {},
  EstadoRegistro: { ACTIVO: 'ACTIVO', ANULADO: 'ANULADO' },
}));

import { TypeORMPagoTransaccionRepository } from '../TypeORMPagoTransaccionRepository';

describe('TypeORMPagoTransaccionRepository.findByCajaConFallback', () => {
  let repo: TypeORMPagoTransaccionRepository;

  beforeEach(() => {
    repo = new TypeORMPagoTransaccionRepository();
    mockGetMany.mockReset();
    mockQueryBuilder.leftJoinAndSelect.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
    mockQueryBuilder.orWhere.mockClear();
  });

  it('consulta pagos de la caja: (pago.cajaId = C OR legacy p.cajaId NULL y registro.cajaId = C) Y registro no ANULADO', async () => {
    const pagos = [{ id: 1, monto: 25000, cajaId: 7 }, { id: 2, monto: 180000, cajaId: null }];
    mockGetMany.mockResolvedValue(pagos);

    const result = await repo.findByCajaConFallback(7);

    expect(result).toEqual(pagos);
    // La unión sin doble conteo: un pago cuenta en UNA sola caja (la suya o la del registro)
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      '(pago.cajaId = :cajaId OR (pago.cajaId IS NULL AND registro.cajaId = :cajaId))',
      { cajaId: 7 },
    );
    // La exclusión de ANULADOS aplica SIEMPRE (ambas ramas), no solo a la legacy
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(registro.estado IS NULL OR registro.estado != :anulado)',
      { anulado: 'ANULADO' },
    );
  });

  it('carga la relación registroServicio para distinguir el fallback legacy', async () => {
    mockGetMany.mockResolvedValue([]);

    await repo.findByCajaConFallback(3);

    expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
      'pago.registroServicio',
      'registro',
    );
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
  MONTO_FIADO_BACKFILL_SELECT_SQL,
  MONTO_FIADO_BACKFILL_UPDATE_SQL,
  MONTO_FIADO_PAYMENT_WINDOW_SECONDS,
  backfillMontoFiado,
  computeMontoFiado,
} from '../montoFiadoBackfill';

describe('computeMontoFiado', () => {
  it('ignores later debt collections: only the at-sale sum is passed', () => {
    // Real case: registro 197 — 60.000 sale with a 0 payment at the sale;
    // the 60.000 transfer collected days later is NOT part of pagadoEnVenta.
    expect(
      computeMontoFiado({ estado: 'ACTIVO', valorFinal: 60000, pagadoEnVenta: 0 }),
    ).toBe(60000);
  });

  it('subtracts the payments made at the sale', () => {
    expect(
      computeMontoFiado({ estado: 'ACTIVO', valorFinal: 60000, pagadoEnVenta: 20000 }),
    ).toBe(40000);
  });

  it('is 0 when the sale was fully paid at sale time', () => {
    expect(
      computeMontoFiado({ estado: 'ACTIVO', valorFinal: 60000, pagadoEnVenta: 60000 }),
    ).toBe(0);
  });

  it('forces 0 for ANULADO registros', () => {
    expect(
      computeMontoFiado({ estado: 'ANULADO', valorFinal: 400000, pagadoEnVenta: 0 }),
    ).toBe(0);
  });

  it('clamps to 0 when payments exceed the sale value', () => {
    expect(
      computeMontoFiado({ estado: 'ACTIVO', valorFinal: 50000, pagadoEnVenta: 70000 }),
    ).toBe(0);
  });

  it('normalizes DECIMAL strings and rounds binary noise to cents', () => {
    expect(
      computeMontoFiado({ estado: 'ACTIVO', valorFinal: '0.30', pagadoEnVenta: '0.10' }),
    ).toBe(0.2);
  });

  it('treats missing amounts as 0', () => {
    expect(
      computeMontoFiado({ estado: 'ACTIVO', valorFinal: null, pagadoEnVenta: null }),
    ).toBe(0);
  });
});

describe('montoFiado backfill', () => {
  it('only scans legacy rows and uses payments inside the sale window', () => {
    expect(MONTO_FIADO_BACKFILL_SELECT_SQL).toContain('WHERE r.montoFiado IS NULL');
    // Payments AFTER the sale (collections) must stay out of the at-sale sum.
    expect(MONTO_FIADO_BACKFILL_SELECT_SQL).toContain(
      `p.creadoEn <= DATE_ADD(r.creadoEn, INTERVAL ${MONTO_FIADO_PAYMENT_WINDOW_SECONDS} SECOND)`,
    );
    expect(MONTO_FIADO_BACKFILL_SELECT_SQL).toContain('p.registroServicioId = r.id');
    expect(MONTO_FIADO_BACKFILL_UPDATE_SQL).toContain('AND montoFiado IS NULL');
  });

  it('writes the computed snapshot per row (sale payments vs collections, anulado)', async () => {
    const legacyRows = [
      // Sale paid 0 at the sale, 60.000 collected later (registro 197 shape).
      { id: 197, estado: 'ACTIVO', valorFinal: '60000.00', pagadoEnVenta: '0.00' },
      // Partial payment at the sale.
      { id: 198, estado: 'ACTIVO', valorFinal: '40000.00', pagadoEnVenta: '10000.00' },
      // Cancelled sale: snapshot must be 0.
      { id: 199, estado: 'ANULADO', valorFinal: '400000.00', pagadoEnVenta: '0.00' },
    ];
    const ds = {
      query: vi.fn(async (sql: string) =>
        sql === MONTO_FIADO_BACKFILL_SELECT_SQL ? legacyRows : { affectedRows: 1 },
      ),
    };

    const summary = await backfillMontoFiado(ds);

    expect(summary).toEqual({ scanned: 3, filled: 3, anulados: 1, withDebt: 2 });
    expect(
      ds.query.mock.calls.filter(([sql]) => sql === MONTO_FIADO_BACKFILL_UPDATE_SQL),
    ).toEqual([
      [MONTO_FIADO_BACKFILL_UPDATE_SQL, [60000, 197]],
      [MONTO_FIADO_BACKFILL_UPDATE_SQL, [30000, 198]],
      [MONTO_FIADO_BACKFILL_UPDATE_SQL, [0, 199]],
    ]);
  });

  it('is a no-op when every row already has a snapshot', async () => {
    const ds = { query: vi.fn().mockResolvedValue([]) };

    const summary = await backfillMontoFiado(ds);

    expect(summary).toEqual({ scanned: 0, filled: 0, anulados: 0, withDebt: 0 });
    expect(ds.query).toHaveBeenCalledTimes(1);
    expect(ds.query).toHaveBeenCalledWith(MONTO_FIADO_BACKFILL_SELECT_SQL);
  });

  it('does not count rows a concurrent run already filled', async () => {
    const ds = {
      query: vi.fn(async (sql: string) =>
        sql === MONTO_FIADO_BACKFILL_SELECT_SQL
          ? [{ id: 197, estado: 'ACTIVO', valorFinal: '60000.00', pagadoEnVenta: '0.00' }]
          : { affectedRows: 0 },
      ),
    };

    const summary = await backfillMontoFiado(ds);

    expect(summary.filled).toBe(0);
  });
});

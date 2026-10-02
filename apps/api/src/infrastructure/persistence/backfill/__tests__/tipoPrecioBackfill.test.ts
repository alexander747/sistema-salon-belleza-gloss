import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { TIPO_PRECIO_BACKFILL_SQL, backfillTipoPrecio } from '../tipoPrecioBackfill';

describe('tipoPrecioBackfill', () => {
  it('targets MARGEN rows with zero cost and a configured price', () => {
    expect(TIPO_PRECIO_BACKFILL_SQL).toContain("SET tipoPrecio='FIJO'");
    expect(TIPO_PRECIO_BACKFILL_SQL).toContain("tipoPrecio='MARGEN'");
    expect(TIPO_PRECIO_BACKFILL_SQL).toContain('precioCompra=0');
    expect(TIPO_PRECIO_BACKFILL_SQL).toContain('precioVenta>0');
  });

  it('returns affectedRows reported by the datasource', async () => {
    const ds = { query: vi.fn().mockResolvedValue({ affectedRows: 7 }) };

    const affected = await backfillTipoPrecio(ds);

    expect(ds.query).toHaveBeenCalledWith(TIPO_PRECIO_BACKFILL_SQL);
    expect(affected).toBe(7);
  });

  it('is a no-op once every row was already migrated (affectedRows 0)', async () => {
    const ds = { query: vi.fn().mockResolvedValue({ affectedRows: 0 }) };

    expect(await backfillTipoPrecio(ds)).toBe(0);
  });

  it('normalizes driver result shapes without affectedRows to 0', async () => {
    const ds = { query: vi.fn().mockResolvedValue(undefined) };

    expect(await backfillTipoPrecio(ds)).toBe(0);
  });
});

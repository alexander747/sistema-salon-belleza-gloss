import { describe, it, expect } from 'vitest';
import { getColombiaDateString, colombiaDayStartUTC, colombiaDayEndUTC } from '../colombia-date';

describe('getColombiaDateString', () => {
  it('convierte una instante UTC a fecha Colombia (10:00 UTC = 05:00 COT del mismo día)', () => {
    expect(getColombiaDateString(new Date('2026-05-15T10:00:00.000Z'))).toBe('2026-05-15');
  });

  it('el límite de día es 05:00 UTC: justo antes pertenece al día anterior', () => {
    // 05:00 UTC = 00:00 COT → 04:59 UTC es 23:59 COT del 14
    expect(getColombiaDateString(new Date('2026-05-15T05:00:00.000Z'))).toBe('2026-05-15');
    expect(getColombiaDateString(new Date('2026-05-15T04:59:59.999Z'))).toBe('2026-05-14');
  });

  it('funciona sin argumentos (fecha actual)', () => {
    expect(getColombiaDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('colombiaDayStartUTC / colombiaDayEndUTC', () => {
  it('inicio del día = 05:00 UTC, fin = 05:00 UTC del día siguiente', () => {
    expect(colombiaDayStartUTC('2026-05-15').toISOString()).toBe('2026-05-15T05:00:00.000Z');
    expect(colombiaDayEndUTC('2026-05-15').toISOString()).toBe('2026-05-16T05:00:00.000Z');
  });
});

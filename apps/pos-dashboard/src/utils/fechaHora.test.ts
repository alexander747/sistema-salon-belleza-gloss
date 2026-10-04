import { describe, it, expect } from 'vitest';
import { buildFechaHora } from './fechaHora.js';

/** Local `yyyy-mm-dd` (same convention as the `type="date"` input). */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('buildFechaHora', () => {
  it('today (local) → the real current instant, not a fixed noon', () => {
    const now = new Date('2026-10-03T15:42:31.123');
    const iso = buildFechaHora(localISODate(now), now);

    expect(iso).toBe(now.toISOString());
    const parsed = new Date(iso);
    expect(parsed.getHours()).toBe(15);
    expect(parsed.getMinutes()).toBe(42);
  });

  it('a past date → local noon anchor preserved (TZ-safe backfill)', () => {
    const now = new Date('2026-10-03T15:42:31.123');
    const iso = buildFechaHora('2026-09-20', now);

    expect(iso).toBe(new Date('2026-09-20T12:00:00').toISOString());
    expect(new Date(iso).getHours()).toBe(12);
  });

  it('a future date is not "today" → noon anchor', () => {
    const now = new Date('2026-10-03T15:42:31.123');
    const iso = buildFechaHora('2026-10-04', now);

    expect(new Date(iso).getHours()).toBe(12);
  });

  it('uses the real clock by default for today (no injected now)', () => {
    const before = Date.now();
    const iso = buildFechaHora(localISODate(new Date()));
    const after = Date.now();

    const t = new Date(iso).getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});

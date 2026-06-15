/**
 * Colombia timezone helpers.
 *
 * Colombia is UTC-5, no DST. The day boundary is 05:00 UTC = 00:00 COT.
 * All business date computations MUST use Colombia date, not UTC date.
 */

const COLOMBIA_UTC_OFFSET_MS = -5 * 3_600_000; // UTC-5 in milliseconds

/** Returns the current date in Colombia timezone as YYYY-MM-DD. */
export function getColombiaDateString(): string {
  const now = new Date();
  const colombiaTime = new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + COLOMBIA_UTC_OFFSET_MS);
  const y = colombiaTime.getUTCFullYear();
  const m = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(colombiaTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns the start of a Colombia day (YYYY-MM-DD) as a UTC Date (05:00 UTC that day). */
export function colombiaDayStartUTC(fecha: string): Date {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

/** Returns the end of a Colombia day (YYYY-MM-DD) as a UTC Date (05:00 UTC next day). */
export function colombiaDayEndUTC(fecha: string): Date {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));
}

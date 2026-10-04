/* Business-date → ISO `fechaHora` for registry creation.
 *
 * The sale forms only capture a date (no time), but the backend stores the
 * instant as-is and binds the cash register by BUSINESS DATE. Rule:
 *  - Selected date is TODAY (local) → use the real current instant, so the
 *    historial shows the real time instead of a fixed 12:00 PM.
 *  - Any other date → anchor to local noon: no real time is known for a
 *    backdated entry and noon is TZ-safe (does not cross the UTC day boundary).
 *
 * Single-sourced so WalkInModal and VentasPage cannot drift apart.
 */

/** Local `yyyy-mm-dd` (same convention as the `type="date"` input value). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Builds the `fechaHora` ISO for a date-only business date.
 * `now` is injectable so tests can pin the clock deterministically.
 */
export function buildFechaHora(fecha: string, now: Date = new Date()): string {
  if (fecha === toISODate(now)) return now.toISOString();
  return new Date(`${fecha}T12:00:00`).toISOString();
}

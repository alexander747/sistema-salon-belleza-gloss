/* ── Formato compartido de moneda (COP, es-CO) ── */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '$0';
  return currencyFormatter.format(n);
}

/* ── Formato de hora 12h (AM/PM) para labels de slots ── */

/**
 * Convierte una hora `"HH:mm"` (24h) a `"hh:mm AM|PM"` (12h).
 * No usa `Date` ni parseo de fecha (evita el timezone trap).
 * Entrada que no matchea `"HH:mm"` se devuelve sin cambios y nunca lanza.
 */
export function formatTimeAMPM(value: string): string {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

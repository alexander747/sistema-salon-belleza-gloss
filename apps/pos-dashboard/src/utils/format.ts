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

/* ── Formato de fecha de CALENDARIO (sin corrimiento de timezone) ── */

/**
 * Formatea una fecha de calendario (`YYYY-MM-DD` o ISO) usando sus
 * componentes locales, para evitar el "timezone trap": `new Date('2026-10-02')`
 * se interpreta como medianoche UTC y en TZ negativas (Bogotá −5) muestra el
 * día ANTERIOR. Acá se construye `new Date(y, m-1, d)` (hora local) → sin shift.
 *
 * Usar SIEMPRE para columnas `DATE` (fecha de negocio), NO para instantes
 * (creadoEn/actualizadoEn/fechaHora), donde sí corresponde `new Date(iso)`.
 */
export function formatCalendarDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
  locale = 'es-CO',
): string {
  if (!value) return '—';
  const iso = typeof value === 'string' ? value : value.toISOString();
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return typeof value === 'string' ? value : '—';
  return new Date(y, m - 1, d).toLocaleDateString(locale, options);
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

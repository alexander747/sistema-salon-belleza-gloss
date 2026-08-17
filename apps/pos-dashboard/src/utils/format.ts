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

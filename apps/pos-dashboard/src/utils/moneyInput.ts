/* ── Helpers puros para inputs de dinero con separador de miles ── */

/** Agrupa dígitos con separador de miles es-CO ("50000" → "50.000"). */
export function formatMoneyDigits(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
}

/**
 * Posición del caret (índice de carácter) en el string formateado que
 * corresponde al dígito `digitIndex` (0-based, cantidad de dígitos ANTES del caret).
 * El separador de miles cuenta como un carácter más.
 */
export function computeMoneyCaret(formatted: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;
  let digitsSeen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      digitsSeen++;
      if (digitsSeen === digitIndex) return i + 1;
    }
  }
  return formatted.length;
}

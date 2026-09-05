/**
 * Normaliza un código de barras para persistencia:
 * ausente (undefined/null), vacío o solo espacios → null; con trim si hay valor.
 * Un producto sin código de barras se guarda como NULL, nunca como ''.
 */
export function normalizeCodigoBarras(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

import { formatCurrency } from './format.js';

/* PR6 — Aclaración discreta de la diferencia Cobrado − Ingresos.
 *
 * `totalCobrado` incluye propinas y abonos de deuda anterior; `totalIngresos`
 * NO incluye propinas. El resumen de Registros NO expone un campo de abonos ni
 * de deuda previa, por lo que el residual por encima de las propinas se describe
 * de forma genérica y NUNCA se fabrica un monto. Todos los valores del API se
 * redondean a entero antes de comparar (mismo criterio que ResumenDiaUseCase).
 */

export interface AclaracionCobradoInput {
  totalIngresos?: number | null;
  totalCobrado?: number | null;
  totalPropinas?: number | null;
}

const FIADO = 'Parte de los ingresos del período aún no se cobró (fiado)';
const RESIDUAL_GENERICO =
  'otros cobros de caja (abonos de deudas anteriores / fiado del período)';
const OTROS_COBROS = `Cobrado incluye ${RESIDUAL_GENERICO}`;
const propsTexto = (tips: number) => `Cobrado incluye ${formatCurrency(tips)} de propinas`;

/**
 * Devuelve el texto de la línea de aclaración, o `null` cuando no debe renderizarse.
 * Regla (D7): `gap === 0` → nada; `gap < 0` → fiado genérico; `gap === propinas`
 * → solo propinas; `gap > propinas` → propinas + residual genérico (sin monto);
 * `propinas === 0` → residual genérico.
 */
export function buildAclaracionCobrado(input: AclaracionCobradoInput): string | null {
  const ingresos = Math.round(input.totalIngresos ?? 0);
  const cobrado = Math.round(input.totalCobrado ?? 0);
  const tips = Math.round(input.totalPropinas ?? 0);
  const gap = cobrado - ingresos;

  if (gap === 0) return null;
  if (gap < 0) return FIADO;

  if (tips > 0 && gap >= tips) {
    return gap > tips ? `${propsTexto(tips)} y ${RESIDUAL_GENERICO}` : propsTexto(tips);
  }

  return OTROS_COBROS;
}

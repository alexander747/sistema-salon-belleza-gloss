/* PR6 revisión — Tira de reconciliación del resumen de Registros (D7).
 *
 * Builder PURO: convierte los valores del resumen (API) en filas de una tira de
 * solo texto, fuera de la grilla de tarjetas. Reglas:
 *  - SIEMPRE devuelve filas (nunca null): la tira no es condicional.
 *  - Las filas de COMPONENTE con valor 0 se omiten.
 *  - Las filas de CIERRE se renderizan siempre.
 *  - El ÚNICO cálculo cliente es `TU CAJA REAL = totalCobrado − totalPropinas`.
 *  - Todos los valores del API se redondean a entero (mismo criterio que el API).
 */

export interface TiraReconciliacionInput {
  totalIngresos?: number | null;
  totalFiadoDia?: number | null;
  /** Cobros de deudas anteriores recibidos en el período (campo del API). */
  cobrosDeudaAnterior?: number | null;
  totalPropinas?: number | null;
  totalCobrado?: number | null;
}

export type TiraRowKind = 'component' | 'divider' | 'closing';

export interface TiraRow {
  kind: TiraRowKind;
  key: string;
  label?: string;
  /** Valor crudo (entero, redondeado). El render lo formatea con formatCurrency. */
  value?: number;
  /** Dirección de la fila para la lectura de la reconciliación. */
  sign?: '+' | '-' | '=';
}

const round = (n: number | null | undefined): number => Math.round(n ?? 0);

export function buildTiraReconciliacion(input: TiraReconciliacionInput): TiraRow[] {
  const ventas = round(input.totalIngresos);
  const fiado = round(input.totalFiadoDia);
  const cobrosAnteriores = round(input.cobrosDeudaAnterior);
  const propinas = round(input.totalPropinas);
  const cobrado = round(input.totalCobrado);

  const componentes: Array<{ key: string; label: string; value: number; sign: '+' | '-' }> = [
    { key: 'ventas', label: 'Ventas del día', value: ventas, sign: '+' },
    { key: 'fiado', label: 'Quedó fiado', value: fiado, sign: '-' },
    { key: 'cobros-anteriores', label: 'Deudas viejas que te pagaron', value: cobrosAnteriores, sign: '+' },
    { key: 'propinas', label: 'Propinas', value: propinas, sign: '+' },
  ];

  const rows: TiraRow[] = [];
  for (const c of componentes) {
    if (c.value !== 0) {
      rows.push({ kind: 'component', key: c.key, label: c.label, value: c.value, sign: c.sign });
    }
  }

  rows.push({ kind: 'divider', key: 'divider-1' });
  rows.push({ kind: 'closing', key: 'cobrado', label: 'Entró a caja', value: cobrado, sign: '=' });
  rows.push({
    kind: 'closing',
    key: 'propinas-cierre',
    label: 'Propinas (van a las chicas)',
    value: propinas,
    sign: '-',
  });
  rows.push({ kind: 'divider', key: 'divider-2' });
  rows.push({
    kind: 'closing',
    key: 'caja-real',
    label: 'TU CAJA REAL (sin propinas)',
    value: cobrado - propinas,
    sign: '=',
  });

  return rows;
}

import { describe, it, expect } from 'vitest';
import { buildTiraReconciliacion, type TiraRow } from './tiraReconciliacion.js';

/**
 * PR6 revisión — Tira de reconciliación (D7).
 *
 * Builder puro: SIEMPRE devuelve filas. Los componentes con valor 0 se omiten;
 * las filas de cierre (Entró a caja / Propinas / TU CAJA REAL) se renderizan
 * siempre. El único cálculo cliente es `TU CAJA REAL = Cobrado − Propinas`.
 * Todos los valores del API se redondean a entero (mismo criterio que el API).
 */
const keysOf = (rows: TiraRow[]) => rows.map((r) => r.key);

describe('buildTiraReconciliacion', () => {
  it('arma las filas en orden con sus signos y cierres (identidad del owner)', () => {
    const rows = buildTiraReconciliacion({
      totalIngresos: 100000,
      totalFiadoDia: 40000,
      cobrosDeudaAnterior: 20000,
      totalPropinas: 5000,
      totalCobrado: 85000,
    });

    expect(keysOf(rows)).toEqual([
      'ventas',
      'fiado',
      'cobros-anteriores',
      'propinas',
      'divider-1',
      'cobrado',
      'propinas-cierre',
      'divider-2',
      'caja-real',
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      'component',
      'component',
      'component',
      'component',
      'divider',
      'closing',
      'closing',
      'divider',
      'closing',
    ]);

    expect(rows[0]).toMatchObject({ label: 'Ventas del día', value: 100000, sign: '+' });
    expect(rows[1]).toMatchObject({ label: 'Quedó fiado', value: 40000, sign: '-' });
    expect(rows[2]).toMatchObject({ label: 'Deudas viejas que te pagaron', value: 20000, sign: '+' });
    expect(rows[3]).toMatchObject({ label: 'Propinas', value: 5000, sign: '+' });
    expect(rows[5]).toMatchObject({ label: 'Entró a caja', value: 85000, sign: '=' });
    expect(rows[6]).toMatchObject({ label: 'Propinas (van a las chicas)', value: 5000, sign: '-' });
    expect(rows[8]).toMatchObject({ label: 'TU CAJA REAL (sin propinas)', value: 80000, sign: '=' });
  });

  it('TU CAJA REAL = Cobrado − Propinas', () => {
    const rows = buildTiraReconciliacion({ totalCobrado: 940000, totalPropinas: 5000 });
    const cajaReal = rows.find((r) => r.key === 'caja-real');
    expect(cajaReal?.value).toBe(935000);
  });

  it('oculta las filas de componente cuyo valor es 0 y mantiene los cierres', () => {
    const rows = buildTiraReconciliacion({
      totalIngresos: 50000,
      totalFiadoDia: 0,
      cobrosDeudaAnterior: 0,
      totalPropinas: 0,
      totalCobrado: 50000,
    });

    expect(rows.filter((r) => r.kind === 'component').map((r) => r.key)).toEqual(['ventas']);
    expect(keysOf(rows)).toEqual(['ventas', 'divider-1', 'cobrado', 'propinas-cierre', 'divider-2', 'caja-real']);
    // Los cierres siguen presentes aunque sus valores sean 0
    expect(rows.find((r) => r.key === 'propinas-cierre')?.value).toBe(0);
  });

  it('sin componentes (todo 0) deja solo los cierres', () => {
    const rows = buildTiraReconciliacion({
      totalIngresos: 0,
      totalFiadoDia: 0,
      cobrosDeudaAnterior: 0,
      totalPropinas: 0,
      totalCobrado: 0,
    });

    expect(rows.filter((r) => r.kind === 'component')).toHaveLength(0);
    expect(keysOf(rows)).toEqual(['divider-1', 'cobrado', 'propinas-cierre', 'divider-2', 'caja-real']);
  });

  it('input vacío/ausente → cierres en 0', () => {
    const rows = buildTiraReconciliacion({});
    expect(rows.find((r) => r.key === 'cobrado')?.value).toBe(0);
    expect(rows.find((r) => r.key === 'caja-real')?.value).toBe(0);
    expect(rows.filter((r) => r.kind === 'component')).toHaveLength(0);
  });

  it('redondea a enteros los valores del API antes de operar', () => {
    const rows = buildTiraReconciliacion({
      totalIngresos: 934999.6,
      totalCobrado: 939999.6,
      totalPropinas: 5000,
    });
    expect(rows.find((r) => r.key === 'ventas')?.value).toBe(935000);
    expect(rows.find((r) => r.key === 'cobrado')?.value).toBe(940000);
    expect(rows.find((r) => r.key === 'caja-real')?.value).toBe(935000);
  });

  it('TU CAJA REAL puede ser negativa si las propinas superan lo cobrado (no se fuerza a positivo)', () => {
    const rows = buildTiraReconciliacion({ totalCobrado: 1000, totalPropinas: 5000 });
    expect(rows.find((r) => r.key === 'caja-real')?.value).toBe(-4000);
  });

  it('T3: el builder sigue emitiendo las filas de propina; la UI las oculta (ocultamiento reversible)', () => {
    const rows = buildTiraReconciliacion({ totalCobrado: 1000, totalPropinas: 5000 });
    // The math is preserved here on purpose: FinanzasPage filters these keys
    // out at render time, so restoring the rows only requires removing that filter.
    expect(rows.map((r) => r.key)).toContain('propinas-cierre');
    expect(rows.map((r) => r.key)).toContain('caja-real');
    expect(rows.find((r) => r.key === 'caja-real')?.value).toBe(-4000);
  });
});

/**
 * Desglose del reparto de una venta: espejo EXACTO de la fórmula del servidor
 * para que la UI muestre los mismos números que se persisten.
 *
 * - `CreateRegistroUseCase.ts:162-174`:
 *     proporcion = (valorFinal − propina) / (montoTotal − propina)
 *     totalServiciosAjustado = round(totalServicios × proporcion)
 * - `ComisionService.ts:11-18`:
 *     comision = max(0, totalServiciosAjustado − insumos) × (porcentaje / 100)
 *
 * El costo de insumos se resta COMPLETO (no se prorratea por el descuento) y el
 * resto se reparte entre la empleada y el salón.
 */

export interface DesgloseRepartoInput {
  /** Σ(precio unitario × cantidad) con precios de catálogo (pre-ajuste). */
  totalServicios: number;
  /** Σ(precioVenta × cantidad) de productos. */
  totalProductos: number;
  /** Propina cobrada (no se reparte ni se descuenta de la base de servicios). */
  propina: number;
  /** Σ(costo unitario × cantidad); el costo real derivado por el servidor. */
  totalCostoInsumos: number;
  /** Total realmente cobrado por la venta (valorFinal). */
  valorFinal: number;
  /** Porcentaje de comisión de la empleada (0–100). */
  porcentajeComision: number;
}

export interface DesgloseReparto {
  /** Parte de servicios del total cobrado, prorrateada por el ajuste. */
  cobradoServicios: number;
  /** Costo de insumos restado completo. */
  insumos: number;
  /** max(0, cobradoServicios − insumos). */
  aRepartir: number;
  /** aRepartir × (porcentaje / 100). */
  comisionEmpleada: number;
  /** aRepartir − comisionEmpleada. */
  quedaSalon: number;
  /** true cuando el insumo se come todo lo cobrado (comisión clampeada a 0). */
  insumoSuperaCobrado: boolean;
}

/** Redondeo defensivo a 2 decimales (mismo criterio que `CostoInsumoService`). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Costo unitario de una línea, espejo de `CostoInsumoService.calcularCostoLinea`:
 * - `POR_GRAMO` → `round2(gramosUsados × precioPorGramo)` (el costo del cliente se ignora).
 * - `FIJO` o ausente → `costoBaseInsumos` (0 si no viene).
 */
export function costoUnitarioLinea(linea: {
  tipoCostoInsumo?: 'FIJO' | 'POR_GRAMO' | null;
  gramosUsados?: number | null;
  precioPorGramo?: number | null;
  costoBaseInsumos?: number | null;
}): number {
  if (linea.tipoCostoInsumo === 'POR_GRAMO') {
    const gramos = Number(linea.gramosUsados ?? 0);
    const precio = Number(linea.precioPorGramo ?? 0);
    return round2(gramos * precio);
  }
  return Number(linea.costoBaseInsumos ?? 0);
}

export function calcularDesgloseReparto(input: DesgloseRepartoInput): DesgloseReparto {
  const {
    totalServicios,
    totalProductos,
    propina,
    totalCostoInsumos,
    valorFinal,
    porcentajeComision,
  } = input;

  const baseBruta = totalServicios + totalProductos;
  const baseReal = valorFinal - propina;
  const proporcion = baseBruta > 0 ? baseReal / baseBruta : 1;
  const cobradoServicios = Math.round(totalServicios * proporcion);

  const aRepartir = Math.max(0, cobradoServicios - totalCostoInsumos);
  const comisionEmpleada = Number((aRepartir * (porcentajeComision / 100)).toFixed(2));
  const quedaSalon = Number((aRepartir - comisionEmpleada).toFixed(2));

  return {
    cobradoServicios,
    insumos: totalCostoInsumos,
    aRepartir,
    comisionEmpleada,
    quedaSalon,
    insumoSuperaCobrado: totalCostoInsumos > 0 && cobradoServicios <= totalCostoInsumos,
  };
}

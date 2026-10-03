/**
 * Desglose del reparto de una venta: espejo EXACTO de la fórmula del servidor
 * para que la UI muestre los mismos números que se persisten.
 *
 * - `CreateRegistroUseCase.ts` (E2):
 *     servNeto = round(totalServicios × (1 − pctServ/100))
 *     pctServ  = (alcance ∈ {SERVICIOS, AMBOS}) ? % : 0
 * - `ComisionService.ts`:
 *     comision = max(0, servNeto − insumos) × (porcentaje / 100)
 *
 * El costo de insumos se resta COMPLETO (no se prorratea por el descuento) y el
 * resto se reparte entre la empleada y el salón. Los productos NUNCA entran en
 * la base de comisión.
 */

export type DescuentoAlcance = 'SERVICIOS' | 'PRODUCTOS' | 'AMBOS';

export interface DesgloseRepartoInput {
  /** Σ(precio unitario × cantidad) con precios efectivos (bruto, pre-descuento). */
  totalServicios: number;
  /** Σ(costo unitario × cantidad); el costo real derivado por el servidor. */
  totalCostoInsumos: number;
  /** Porcentaje de descuento (0–100). */
  porcentajeDescuento: number;
  /** Alcance del descuento: solo servicios, solo productos, o ambos. */
  descuentoAlcance: DescuentoAlcance;
  /** Porcentaje de comisión de la empleada (0–100). */
  porcentajeComision: number;
}

export interface DesgloseReparto {
  /** Parte de servicios del total cobrado, con el % de servicios aplicado. */
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

/** Etiqueta legible del alcance del descuento (para notas y UI). */
export function alcanceLabel(alcance: DescuentoAlcance): string {
  if (alcance === 'SERVICIOS') return 'servicios';
  if (alcance === 'PRODUCTOS') return 'productos';
  return 'servicios y productos';
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
  costoInsumosOverride?: number | null;
}): number {
  // Override editado por el usuario (descuento de insumos): gana sobre el derivado.
  if (linea.costoInsumosOverride != null) {
    return round2(Number(linea.costoInsumosOverride));
  }
  if (linea.tipoCostoInsumo === 'POR_GRAMO') {
    const gramos = Number(linea.gramosUsados ?? 0);
    const precio = Number(linea.precioPorGramo ?? 0);
    return round2(gramos * precio);
  }
  return Number(linea.costoBaseInsumos ?? 0);
}

/**
 * Línea de servicio de una cita ya expandida con su precio efectivo y cantidad.
 * Fuente única para el total que se MUESTRA en el modal y el que viaja en el POST.
 */
export interface LineaServicioCita {
  id: number;
  /** Precio efectivo: override del formulario o el precio original de la cita. */
  precio: number;
  /** Unidades (≥1; legacy sin `cantidad` = 1). */
  cantidad: number;
}

/**
 * Expande los servicios de una cita con su precio efectivo (override o catálogo)
 * y su cantidad. Compartido por el display del modal y el payload del POST para
 * que `cantidad > 1` no pueda divergir entre lo que se ve y lo que se cobra.
 */
export function lineasServicioCita(
  servicios: ReadonlyArray<{ id: number; precio: number; cantidad?: number | null }>,
  precios: Readonly<Record<number, number>>,
): LineaServicioCita[] {
  return servicios.map((s) => ({
    id: s.id,
    precio: precios[s.id] ?? s.precio,
    cantidad: s.cantidad ?? 1,
  }));
}

/** Σ(precio × cantidad) de las líneas de una cita. */
export function totalServiciosCita(lineas: ReadonlyArray<LineaServicioCita>): number {
  return lineas.reduce((sum, l) => sum + l.precio * l.cantidad, 0);
}

export function calcularDesgloseReparto(input: DesgloseRepartoInput): DesgloseReparto {
  const {
    totalServicios,
    totalCostoInsumos,
    porcentajeDescuento,
    descuentoAlcance,
    porcentajeComision,
  } = input;

  // El % de servicios solo aplica si el alcance incluye SERVICIOS. El de
  // productos no afecta este desglose (nunca entra en la comisión).
  const pctServ =
    descuentoAlcance === 'SERVICIOS' || descuentoAlcance === 'AMBOS' ? porcentajeDescuento : 0;
  const cobradoServicios = Math.round(totalServicios * (1 - pctServ / 100));

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

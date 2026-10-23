/**
 * Effective per-line amounts for a sale detail.
 *
 * The API keeps the list price on every line (`precioServicio`, `subtotal`)
 * while the charged amount lives on the registro (`valorFinal`). To make the
 * detail table reconcile with the header, each line is prorated by
 * `factor = (valorFinal − propina) / (totalServicios + totalProductos)` and the
 * rounding residual is assigned to the largest line so the sum matches the
 * charged total exactly.
 */

export interface AllocatableServicio {
  precioServicio: number;
}

export interface AllocatableProducto {
  subtotal: number;
}

export interface RegistroItemsInput {
  servicios: ReadonlyArray<AllocatableServicio>;
  productos: ReadonlyArray<AllocatableProducto>;
  totalServicios: number;
  totalProductos: number;
  valorFinal?: number | null;
  propina?: number | null;
}

export interface RegistroItemsAllocation {
  /** Effective amount per service line, in the same order as the input. */
  servicios: number[];
  /** Effective amount per product line, in the same order as the input. */
  productos: number[];
  /** Effective line total. Equals the charged items total when `valorFinal` is set. */
  total: number;
  /** Applied factor; 1 when there is nothing to prorate. */
  factor: number;
}

const toAmount = (value: number | null | undefined): number =>
  Math.max(0, Math.round(Number(value) || 0));

export function allocateRegistroItems({
  servicios,
  productos,
  totalServicios,
  totalProductos,
  valorFinal,
  propina,
}: RegistroItemsInput): RegistroItemsAllocation {
  const serviceBases = servicios.map((item) => toAmount(item.precioServicio));
  const productBases = productos.map((item) => toAmount(item.subtotal));
  const bases = [...serviceBases, ...productBases];
  const listTotal = toAmount(totalServicios) + toAmount(totalProductos);

  // No charged amount: keep the list values untouched.
  if (valorFinal == null) {
    return {
      servicios: serviceBases,
      productos: productBases,
      total: listTotal,
      factor: 1,
    };
  }

  const chargedItemsTotal = Math.max(0, toAmount(valorFinal) - toAmount(propina));

  // Nothing to prorate: there are no list prices to distribute the factor over.
  if (listTotal <= 0) {
    return {
      servicios: serviceBases,
      productos: productBases,
      total: chargedItemsTotal,
      factor: 1,
    };
  }

  const factor = chargedItemsTotal / listTotal;
  const amounts = bases.map((base) => Math.round(base * factor));

  // Move the rounding residual onto the largest line so the sum is exact.
  const residual = chargedItemsTotal - amounts.reduce((sum, amount) => sum + amount, 0);
  if (residual !== 0 && amounts.length > 0) {
    let largestIndex = 0;
    for (let index = 1; index < bases.length; index += 1) {
      if (bases[index] > bases[largestIndex]) largestIndex = index;
    }
    amounts[largestIndex] = Math.max(0, amounts[largestIndex] + residual);
  }

  return {
    servicios: amounts.slice(0, servicios.length),
    productos: amounts.slice(servicios.length),
    total: amounts.reduce((sum, amount) => sum + amount, 0),
    factor,
  };
}

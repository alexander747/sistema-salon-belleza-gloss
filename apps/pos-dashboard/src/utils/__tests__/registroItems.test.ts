import { describe, it, expect } from 'vitest';
import { allocateRegistroItems } from '../registroItems';

describe('allocateRegistroItems', () => {
  it('prorates every line and puts the rounding residual on the largest line', () => {
    const result = allocateRegistroItems({
      servicios: [{ precioServicio: 3 }, { precioServicio: 3 }, { precioServicio: 3 }],
      productos: [],
      totalServicios: 9,
      totalProductos: 0,
      valorFinal: 10,
    });

    // 10/9 per line rounds down to 3; the leftover unit goes to the largest line.
    expect(result.servicios).toEqual([4, 3, 3]);
    expect(result.total).toBe(10);
  });

  it('keeps list prices when there is no charged amount', () => {
    const result = allocateRegistroItems({
      servicios: [{ precioServicio: 40000 }, { precioServicio: 40000 }],
      productos: [],
      totalServicios: 80000,
      totalProductos: 0,
      valorFinal: null,
    });

    expect(result.servicios).toEqual([40000, 40000]);
    expect(result.factor).toBe(1);
    expect(result.total).toBe(80000);
  });

  it('excludes the tip from the prorated base', () => {
    const result = allocateRegistroItems({
      servicios: [{ precioServicio: 80000 }],
      productos: [{ subtotal: 20000 }],
      totalServicios: 80000,
      totalProductos: 20000,
      valorFinal: 70000,
      propina: 5000,
    });

    expect(result.servicios).toEqual([52000]);
    expect(result.productos).toEqual([13000]);
    expect(result.total).toBe(65000);
  });
});

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCarrito } from '../useCarrito.js';

const corte = { id: 1, nombre: 'Corte', precioFinal: 30000, duracionMinutos: 60 };
const tintura = {
  id: 7,
  nombre: 'Tintura',
  precioFinal: 450000,
  duracionMinutos: 120,
  tipoCostoInsumo: 'POR_GRAMO' as const,
  precioPorGramo: 1200,
};
const shampoo = { id: 2, nombre: 'Shampoo', precioVenta: 15000, cantidadStock: 5 };

describe('useCarrito — lines', () => {
  it('addServicio increments quantity on re-click instead of duplicating', () => {
    const { result } = renderHook(() => useCarrito());

    act(() => result.current.addServicio(corte));
    act(() => result.current.addServicio(corte));

    expect(result.current.servicios).toHaveLength(1);
    expect(result.current.servicios[0].cantidad).toBe(2);
    expect(result.current.totalServicios).toBe(60000);
  });

  it('addProducto respects stock and increments up to the cap', () => {
    const { result } = renderHook(() => useCarrito());
    const low = { ...shampoo, cantidadStock: 2 };

    act(() => result.current.addProducto(low));
    act(() => result.current.addProducto(low));
    act(() => result.current.addProducto(low));

    expect(result.current.productos[0].cantidad).toBe(2);
    expect(result.current.totalProductos).toBe(30000);
  });

  it('addProducto is a no-op when out of stock', () => {
    const { result } = renderHook(() => useCarrito());

    act(() => result.current.addProducto({ ...shampoo, cantidadStock: 0 }));

    expect(result.current.productos).toHaveLength(0);
  });

  it('updateServicioQty removes the line when it reaches 0', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => result.current.addServicio(corte));

    act(() => result.current.updateServicioQty(1, -1));

    expect(result.current.servicios).toHaveLength(0);
  });
});

describe('useCarrito — discount scope', () => {
  it('applies the % only to SERVICIOS when scope is SERVICIOS', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte); // 30.000
      result.current.addProducto(shampoo); // 15.000
      result.current.setDescuento(10);
      result.current.setDescuentoAlcance('SERVICIOS');
    });

    expect(result.current.subtotal).toBe(45000);
    expect(result.current.descuentoMonto).toBe(3000); // solo servicios
    expect(result.current.finalTotal).toBe(42000);
  });

  it('applies the % only to PRODUCTOS when scope is PRODUCTOS', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.addProducto(shampoo);
      result.current.setDescuento(10);
      result.current.setDescuentoAlcance('PRODUCTOS');
    });

    expect(result.current.descuentoMonto).toBe(1500); // solo productos
    expect(result.current.finalTotal).toBe(43500);
  });

  it('applies the % to both when scope is AMBOS', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.addProducto(shampoo);
      result.current.setDescuento(10);
      result.current.setDescuentoAlcance('AMBOS');
    });

    expect(result.current.descuentoMonto).toBe(4500);
    expect(result.current.finalTotal).toBe(40500);
  });
});

describe('useCarrito — alcances aplicables (discount scope)', () => {
  it('offers only SERVICIOS and auto-points the scope for a services-only cart', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => result.current.addServicio(corte));

    expect(result.current.alcancesAplicables).toEqual(['SERVICIOS']);
    expect(result.current.descuentoAlcance).toBe('SERVICIOS');
  });

  it('offers only PRODUCTOS and auto-points the scope for a products-only cart', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => result.current.addProducto(shampoo));

    expect(result.current.alcancesAplicables).toEqual(['PRODUCTOS']);
    expect(result.current.descuentoAlcance).toBe('PRODUCTOS');
  });

  it('offers all three scopes when both services and products exist', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.addProducto(shampoo);
    });

    expect(result.current.alcancesAplicables).toEqual(['SERVICIOS', 'PRODUCTOS', 'AMBOS']);
    expect(result.current.descuentoAlcance).toBe('AMBOS');
  });

  it('offers no scope when the cart is empty', () => {
    const { result } = renderHook(() => useCarrito());
    expect(result.current.alcancesAplicables).toEqual([]);
  });

  it('hasAdjustment is false when the discount is ineffective ($0) and true when it applies', () => {
    const { result } = renderHook(() => useCarrito());
    // Empty cart: a % yields no effective discount.
    act(() => {
      result.current.setDescuento(10);
      result.current.setDescuentoAlcance('SERVICIOS');
    });
    expect(result.current.descuentoMonto).toBe(0);
    expect(result.current.hasAdjustment).toBe(false);

    act(() => result.current.addServicio(corte));
    expect(result.current.descuentoMonto).toBe(3000);
    expect(result.current.hasAdjustment).toBe(true);
  });
});

describe('useCarrito — payments', () => {
  it('cash: cambio and pendiente follow montoRecibido', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte); // 30.000
      result.current.setMontoRecibido(50000);
    });

    expect(result.current.cambio).toBe(20000);
    expect(result.current.pendiente).toBe(0);
    expect(result.current.pagoSuficiente).toBe(true);
  });

  it('fiado partial: pendiente excludes the tip and pagoSuficiente is true with $0', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.setPropina(1000);
      result.current.setEsFiado(true);
      result.current.setMontoRecibido(0);
    });

    // 30.000 + 1.000 propina - 0 pagado - 1.000 propina (no se fía) = 30.000
    expect(result.current.pendiente).toBe(30000);
    expect(result.current.pagoSuficiente).toBe(true);
  });

  it('buildPago: cash uses montoRecibido; card uses the final total', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.setMontoRecibido(30000);
    });
    expect(result.current.buildPago()).toEqual({ monto: 30000, metodoPago: 'EFECTIVO' });

    act(() => result.current.setPaymentMethod('TARJETA'));
    expect(result.current.buildPago()).toEqual({ monto: 30000, metodoPago: 'TARJETA' });
  });

  it('buildPago: fiado sends the amount charged (0 = full fiado)', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.setPaymentMethod('TARJETA');
      result.current.setEsFiado(true);
      result.current.setMontoRecibido(0);
    });

    expect(result.current.buildPago()).toEqual({ monto: 0, metodoPago: 'TARJETA' });
  });

  it('buildPago includes a trimmed referencia only when present', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.setReferencia('  ABC-1 ');
    });

    expect(result.current.buildPago()).toEqual({
      monto: 0,
      metodoPago: 'EFECTIVO',
      referencia: 'ABC-1',
    });
  });
});

describe('useCarrito — gramos and notes', () => {
  it('faltanGramos is true until a POR_GRAMO line has grams', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => result.current.addServicio(tintura));
    expect(result.current.faltanGramos).toBe(true);

    act(() => result.current.updateServicioGramos(7, 95));
    expect(result.current.faltanGramos).toBe(false);
  });

  it('buildNotas prepends the adjustment block only when there is a discount', () => {
    const { result } = renderHook(() => useCarrito());
    expect(result.current.buildNotas('base')).toBe('base');

    act(() => {
      result.current.addServicio(corte);
      result.current.setDescuento(10);
      result.current.setDescuentoAlcance('SERVICIOS');
      result.current.setNotaAjuste('promo');
    });

    expect(result.current.buildNotas('base')).toBe(
      '[AJUSTE: descuento 10% servicios] Razón: promo\nbase',
    );
    expect(result.current.buildNotas(undefined)).toBe(
      '[AJUSTE: descuento 10% servicios] Razón: promo',
    );
  });
});

describe('useCarrito — reset', () => {
  it('reset clears lines and payment state, keeping the method unless passed', () => {
    const { result } = renderHook(() => useCarrito());
    act(() => {
      result.current.addServicio(corte);
      result.current.addProducto(shampoo);
      result.current.setPaymentMethod('TARJETA');
      result.current.setMontoRecibido(5000);
      result.current.setDescuento(10);
      result.current.setNotaAjuste('x');
    });

    act(() => result.current.reset());

    expect(result.current.carritoVacio).toBe(true);
    expect(result.current.montoRecibido).toBe(0);
    expect(result.current.descuento).toBe(0);
    expect(result.current.notaAjuste).toBe('');
    expect(result.current.paymentMethod).toBe('TARJETA'); // preserved by default

    act(() => result.current.reset({ paymentMethod: 'EFECTIVO' }));
    expect(result.current.paymentMethod).toBe('EFECTIVO');
  });
});

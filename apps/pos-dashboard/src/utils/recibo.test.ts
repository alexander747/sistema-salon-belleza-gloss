import { describe, it, expect } from 'vitest';
import { buildRecibo, numeroDeRegistro, fechaDeRegistro } from './recibo';

describe('buildRecibo — recibo de venta desde líneas del carrito', () => {
  it('calcula el subtotal de cada línea (cantidad × precio) y propaga totales', () => {
    const recibo = buildRecibo({
      numero: 7,
      fecha: '2026-09-04T12:00:00.000Z',
      clienteNombre: 'Ana',
      empleadaNombre: 'María',
      lineas: [
        { tipo: 'SERVICIO', nombre: 'Corte', cantidad: 1, precio: 30000 },
        { tipo: 'PRODUCTO', nombre: 'Shampoo', cantidad: 2, precio: 10000 },
      ],
      metodoPago: 'EFECTIVO',
      total: 50000,
      propina: 0,
      montoPendiente: 0,
    });

    expect(recibo.lineas).toEqual([
      { tipo: 'SERVICIO', nombre: 'Corte', cantidad: 1, precio: 30000, subtotal: 30000 },
      { tipo: 'PRODUCTO', nombre: 'Shampoo', cantidad: 2, precio: 10000, subtotal: 20000 },
    ]);
    expect(recibo.total).toBe(50000);
    expect(recibo.numero).toBe(7);
    expect(recibo.fecha).toBe('2026-09-04T12:00:00.000Z');
  });

  it('con un solo servicio (cantidad 1) el subtotal iguala al precio unitario', () => {
    const recibo = buildRecibo({
      fecha: '2026-09-04T12:00:00.000Z',
      clienteNombre: 'Ana',
      empleadaNombre: 'María',
      lineas: [{ tipo: 'SERVICIO', nombre: 'Corte', cantidad: 1, precio: 45000 }],
      metodoPago: 'TARJETA',
      total: 45000,
    });

    expect(recibo.lineas[0].subtotal).toBe(45000);
    // defaults
    expect(recibo.numero).toBeNull();
    expect(recibo.propina).toBe(0);
    expect(recibo.descuento).toBe(0);
    expect(recibo.montoPendiente).toBe(0);
  });

  it('propina, descuento y pendiente viajan tal cual cuando vienen definidos', () => {
    const recibo = buildRecibo({
      fecha: '2026-09-04T12:00:00.000Z',
      clienteNombre: 'Ana',
      empleadaNombre: 'María',
      lineas: [{ tipo: 'SERVICIO', nombre: 'Corte', cantidad: 1, precio: 90000 }],
      metodoPago: 'EFECTIVO',
      total: 85000,
      propina: 5000,
      descuento: 10000,
      descuentoPorcentaje: 10,
      montoPendiente: 85000,
    });

    expect(recibo.propina).toBe(5000);
    expect(recibo.descuento).toBe(10000);
    expect(recibo.descuentoPorcentaje).toBe(10);
    expect(recibo.montoPendiente).toBe(85000);
  });
});

describe('numeroDeRegistro / fechaDeRegistro — extraer datos del POST response', () => {
  it('toma el id numérico de la respuesta del registro', () => {
    expect(numeroDeRegistro({ id: 42, montoTotal: 30000 })).toBe(42);
    expect(numeroDeRegistro({})).toBeNull();
    expect(numeroDeRegistro(null)).toBeNull();
    expect(numeroDeRegistro({ id: 'x' })).toBeNull();
  });

  it('fechaDeRegistro usa fechaHora de la respuesta y cae al fallback si no viene', () => {
    const iso = '2026-09-04T12:00:00.000Z';
    expect(fechaDeRegistro({ fechaHora: iso }, '2000-01-01T00:00:00.000Z')).toBe(iso);
    expect(fechaDeRegistro({}, '2000-01-01T00:00:00.000Z')).toBe('2000-01-01T00:00:00.000Z');
    expect(fechaDeRegistro(null, '2000-01-01T00:00:00.000Z')).toBe('2000-01-01T00:00:00.000Z');
  });
});

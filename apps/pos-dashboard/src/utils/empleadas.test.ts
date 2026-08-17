import { describe, it, expect } from 'vitest';
import { filterEmpleadasActivas, type EmpleadaConActivo } from './empleadas';

const empleada = (id: number, activo?: boolean): EmpleadaConActivo => ({
  id,
  nombre: `Empleada ${id}`,
  ...(activo !== undefined ? { activo } : {}),
});

describe('filterEmpleadasActivas', () => {
  it('incluye empleadas activas (activo: true)', () => {
    const list = [empleada(1, true), empleada(2, true)];
    expect(filterEmpleadasActivas(list).map((e) => e.id)).toEqual([1, 2]);
  });

  it('excluye empleadas inactivas (activo: false)', () => {
    const list = [empleada(1, true), empleada(2, false), empleada(3, true)];
    expect(filterEmpleadasActivas(list).map((e) => e.id)).toEqual([1, 3]);
  });

  it('trata activo indefinido como activa (compatibilidad con DTOs que no lo exponen)', () => {
    const list = [empleada(1), empleada(2, false), empleada(3, true)];
    expect(filterEmpleadasActivas(list).map((e) => e.id)).toEqual([1, 3]);
  });

  it('devuelve lista vacía cuando todas están inactivas', () => {
    const list = [empleada(1, false), empleada(2, false)];
    expect(filterEmpleadasActivas(list)).toEqual([]);
  });

  it('no muta la lista original', () => {
    const list = [empleada(1, true), empleada(2, false)];
    const copy = [...list];
    filterEmpleadasActivas(list);
    expect(list).toEqual(copy);
  });
});

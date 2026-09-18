import { describe, it, expect } from 'vitest';
import { CitaDTO } from '../CitaDTO';

interface Linea {
  id: number;
  nombre: string;
  duracionMinutos: number;
  precioBase: number;
  costoBaseInsumos?: number;
  cantidad: number;
}

function citaCon(lineas: Linea[]) {
  return {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    fechaHora: new Date('2026-06-01T10:00:00'),
    estado: 'PENDIENTE',
    notas: null,
    esWalkIn: false,
    citasServicios: lineas.map((l) => ({
      citasId: 1,
      serviciosId: l.id,
      cantidad: l.cantidad,
      servicio: {
        id: l.id,
        nombre: l.nombre,
        duracionMinutos: l.duracionMinutos,
        precioBase: l.precioBase,
        costoBaseInsumos: l.costoBaseInsumos ?? 0,
      },
    })),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };
}

describe('CitaDTO — cantidad por servicio', () => {
  it('mapea la cantidad y calcula duración Σ(duracion × cantidad)', () => {
    const dto = CitaDTO.fromEntity(
      citaCon([
        { id: 1, nombre: 'Corte', duracionMinutos: 60, precioBase: 30000, cantidad: 2 },
      ]) as never,
    );

    expect(dto.servicios).toHaveLength(1);
    expect(dto.servicios[0]).toMatchObject({ id: 1, nombre: 'Corte', cantidad: 2 });
    expect(dto.duracionTotalMinutos).toBe(120);
  });

  it('legacy (cantidad=1) mantiene la duración previa', () => {
    const dto = CitaDTO.fromEntity(
      citaCon([
        { id: 2, nombre: 'Pies', duracionMinutos: 30, precioBase: 20000, cantidad: 1 },
      ]) as never,
    );

    expect(dto.servicios[0].cantidad).toBe(1);
    expect(dto.duracionTotalMinutos).toBe(30);
  });

  it('suma mixta: 60×1 + 30×3 = 150', () => {
    const dto = CitaDTO.fromEntity(
      citaCon([
        { id: 1, nombre: 'Corte', duracionMinutos: 60, precioBase: 30000, cantidad: 1 },
        { id: 2, nombre: 'Pies', duracionMinutos: 30, precioBase: 20000, cantidad: 3 },
      ]) as never,
    );

    expect(dto.servicios).toHaveLength(2);
    expect(dto.duracionTotalMinutos).toBe(150);
  });
});

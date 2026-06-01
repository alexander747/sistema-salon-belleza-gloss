import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { EmpleadaDTO } from '../EmpleadaDTO';
import { Rol } from '@pos-final/types';
import type { UsuarioEntity } from '../../../../../infrastructure/persistence/entities/UsuarioEntity';

function makeEmpleadaEntity(overrides: Partial<UsuarioEntity> = {}): UsuarioEntity {
  return {
    id: 1,
    nombre: 'Ana',
    numeroWhatsApp: '+541112345',
    email: 'ana@test.com',
    avatar: null,
    fechaNacimiento: null,
    rol: Rol.MANICURISTA,
    activo: true,
    porcentajeComisionServicio: '30',
    sueldoFijo: '50000',
    bonoHorario: '1000',
    frecuenciaBono: 'mensual',
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    passwordHash: null,
    refreshToken: null,
    refreshTokenFamily: null,
    ...overrides,
  } as unknown as UsuarioEntity;
}

describe('EmpleadaDTO', () => {
  describe('fromEntity', () => {
    it('should include compensation fields for DUEÑA', () => {
      const entity = makeEmpleadaEntity();
      const dto = EmpleadaDTO.fromEntity(entity, Rol.DUEÑA);

      expect(dto.porcentajeComisionServicio).toBe(30);
      expect(dto.sueldoFijo).toBe(50000);
      expect(dto.bonoHorario).toBe(1000);
      expect(dto.frecuenciaBono).toBe('mensual');
    });

    it('should include compensation fields for ADMINISTRADOR', () => {
      const entity = makeEmpleadaEntity();
      const dto = EmpleadaDTO.fromEntity(entity, Rol.ADMINISTRADOR);

      expect(dto.porcentajeComisionServicio).toBe(30);
      expect(dto.sueldoFijo).toBe(50000);
      expect(dto.bonoHorario).toBe(1000);
      expect(dto.frecuenciaBono).toBe('mensual');
    });

    it('should strip compensation fields for MANICURISTA', () => {
      const entity = makeEmpleadaEntity();
      const dto = EmpleadaDTO.fromEntity(entity, Rol.MANICURISTA);

      expect(dto.porcentajeComisionServicio).toBeNull();
      expect(dto.sueldoFijo).toBeNull();
      expect(dto.bonoHorario).toBeNull();
      expect(dto.frecuenciaBono).toBeNull();
    });

    it('should always include basic fields regardless of role', () => {
      const entity = makeEmpleadaEntity();
      const dto = EmpleadaDTO.fromEntity(entity, Rol.MANICURISTA);

      expect(dto.id).toBe(1);
      expect(dto.nombre).toBe('Ana');
      expect(dto.numeroWhatsApp).toBe('+541112345');
      expect(dto.email).toBe('ana@test.com');
      expect(dto.rol).toBe(Rol.MANICURISTA);
      expect(dto.activo).toBe(true);
    });
  });
});

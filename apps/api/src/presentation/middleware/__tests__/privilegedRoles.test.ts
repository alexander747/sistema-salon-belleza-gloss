import { describe, it, expect } from 'vitest';
import { Rol } from '@pos-final/types';
import {
  PRIVILEGED_ROLES,
  PRIVILEGED_ROLES_LIST,
  isPrivilegedRole,
} from '../privilegedRoles';

/**
 * Single source of truth for the "privileged roles" rule (owner decision):
 * SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR only.
 * Every gate in the backend (ReporteController, RegistroController, routes)
 * MUST resolve through this module so the rule cannot drift.
 */
describe('privilegedRoles', () => {
  it('trata como privilegiados a SUPERADMIN, DUEÑA, ADMINISTRADOR y CONTADOR', () => {
    expect(isPrivilegedRole(Rol.SUPERADMIN)).toBe(true);
    expect(isPrivilegedRole(Rol.DUEÑA)).toBe(true);
    expect(isPrivilegedRole(Rol.ADMINISTRADOR)).toBe(true);
    expect(isPrivilegedRole(Rol.CONTADOR)).toBe(true);
  });

  it('trata como NO privilegiados a MANICURISTA y RECEPCIONISTA', () => {
    expect(isPrivilegedRole(Rol.MANICURISTA)).toBe(false);
    expect(isPrivilegedRole(Rol.RECEPCIONISTA)).toBe(false);
  });

  it('trata null/undefined como NO privilegiado (sin sesión)', () => {
    expect(isPrivilegedRole(null)).toBe(false);
    expect(isPrivilegedRole(undefined)).toBe(false);
  });

  it('la lista y el set exponen exactamente los 4 roles, en orden', () => {
    expect(PRIVILEGED_ROLES_LIST).toEqual([
      Rol.SUPERADMIN,
      Rol.DUEÑA,
      Rol.ADMINISTRADOR,
      Rol.CONTADOR,
    ]);
    expect([...PRIVILEGED_ROLES].sort()).toEqual(
      [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR].sort(),
    );
  });

  it('el set y la lista no pueden divergir (misma fuente)', () => {
    for (const rol of PRIVILEGED_ROLES_LIST) {
      expect(PRIVILEGED_ROLES.has(rol)).toBe(true);
      expect(isPrivilegedRole(rol)).toBe(true);
    }
    expect(PRIVILEGED_ROLES.size).toBe(PRIVILEGED_ROLES_LIST.length);
  });
});

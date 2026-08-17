/** Numeric Rol enum matching TypeORM storage. */
export enum Rol {
  SUPERADMIN = 1,
  DUEÑA = 2,
  ADMINISTRADOR = 3,
  MANICURISTA = 4,
  RECEPCIONISTA = 5,
  CONTADOR = 6,
}

/** Frecuencia con la que se liquida el sueldo fijo de una empleada. */
export type FrecuenciaPago = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL';

/** Core user entity shape shared across frontend and backend. */
export interface IUser {
  id: number;
  nombre: string;
  numeroWhatsApp: string;
  email: string;
  passwordHash?: string;
  avatar?: string;
  fechaNacimiento?: Date;
  rol: Rol;
  salonId: number;
  porcentajeComisionServicio: number;
  sueldoFijo: number;
  bonoHorario: number;
  frecuenciaBono?: string;
  frecuenciaPago?: FrecuenciaPago;
  activo: boolean;
  refreshToken?: string | null;
  refreshTokenFamily?: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

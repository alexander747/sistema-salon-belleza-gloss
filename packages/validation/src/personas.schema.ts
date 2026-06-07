import { z } from 'zod';
import { Rol } from '@pos-final/types';

// ── Empleadas ───────────────────────────────────────────────

export const createEmpleadaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  numeroWhatsApp: z.string().min(1, 'El WhatsApp es requerido').max(20),
  email: z.string().email('Email inválido').max(200),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
  rol: z.nativeEnum(Rol, { errorMap: () => ({ message: 'Rol inválido' }) }).refine(
    (val) => val !== Rol.SUPERADMIN,
    { message: 'No se puede crear un SUPERADMIN' },
  ),
  avatar: z.string().max(255).optional(),
  fechaNacimiento: z.string().optional(),
  porcentajeComisionServicio: z.number().min(0).max(100).default(0),
  sueldoFijo: z.number().min(0).default(0),
  bonoHorario: z.number().min(0).default(0),
  frecuenciaBono: z.string().max(20).optional(),
});

export type CreateEmpleadaInput = z.infer<typeof createEmpleadaSchema>;

export const updateEmpleadaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100).optional(),
  numeroWhatsApp: z.string().min(1, 'El WhatsApp es requerido').max(20).optional(),
  email: z.string().email('Email inválido').max(200).optional(),
  password: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100).optional()),
  rol: z.nativeEnum(Rol, { errorMap: () => ({ message: 'Rol inválido' }) }).refine(
    (val) => val !== Rol.SUPERADMIN,
    { message: 'No se puede asignar SUPERADMIN' },
  ).optional(),
  avatar: z.string().max(255).optional(),
  fechaNacimiento: z.string().optional(),
  porcentajeComisionServicio: z.number().min(0).max(100).optional(),
  sueldoFijo: z.number().min(0).optional(),
  bonoHorario: z.number().min(0).optional(),
  frecuenciaBono: z.string().max(20).optional(),
});

export type UpdateEmpleadaInput = z.infer<typeof updateEmpleadaSchema>;

// ── Clientes ────────────────────────────────────────────────

export const createClienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  telefono: z.string().min(1, 'El teléfono es requerido').max(20),
  cedula: z.string().max(20).optional(),
  email: z.string().email('Email inválido').max(200).optional(),
  fechaNacimiento: z.string().optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;

export const updateClienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100).optional(),
  telefono: z.string().min(1, 'El teléfono es requerido').max(20).optional(),
  cedula: z.string().max(20).optional(),
  email: z.string().email('Email inválido').max(200).optional(),
  fechaNacimiento: z.string().optional(),
});

export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;

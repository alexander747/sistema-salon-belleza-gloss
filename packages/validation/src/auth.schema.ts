import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('El email no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'El token de refresco es requerido'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

export const createUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  numeroWhatsApp: z.string().regex(/^\d{10,20}$/, 'Número de WhatsApp inválido'),
  email: z.string().email('El email no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  rol: z.number().int().min(1).max(6),
  salonId: z.number().int().positive(),
  porcentajeComisionServicio: z.number().min(0).max(100).default(0),
  sueldoFijo: z.number().min(0).default(0),
  bonoHorario: z.number().min(0).default(0),
  activo: z.boolean().default(true),
});

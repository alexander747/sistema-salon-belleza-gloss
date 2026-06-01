import { z } from 'zod';

export const createSalonSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150),
  numeroWhatsApp: z
    .string()
    .regex(/^\d{10,20}$/, 'Número de WhatsApp inválido (debe contener solo dígitos, 10-20)'),
  nombreBot: z.string().max(100).default('Asistente Virtual'),
  tonoVoz: z.string().max(20).default('amigable'),
  logoUrl: z.string().url().optional().nullable(),
  colorPrimario: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color primario debe ser hex válido (ej: #FF5733)')
    .optional()
    .nullable(),
  colorSecundario: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color secundario debe ser hex válido')
    .optional()
    .nullable(),
  tema: z.enum(['claro', 'oscuro']).optional().nullable(),
  horasCancelacion: z.number().int().min(0).default(24),
});

export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export const updateSalonSchema = createSalonSchema.partial().extend({
  ownerPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
});

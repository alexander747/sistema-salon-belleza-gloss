import { z } from 'zod';

// ── Categorías ──────────────────────────────────────────────

export const createCategoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().max(300).optional(),
  emoji: z.string().max(10).optional(),
  orden: z.number().int().min(0).default(0),
});

export type CreateCategoriaInput = z.infer<typeof createCategoriaSchema>;

export const updateCategoriaSchema = createCategoriaSchema.partial();

export type UpdateCategoriaInput = z.infer<typeof updateCategoriaSchema>;

// ── Servicios ───────────────────────────────────────────────

export const createServicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150),
  descripcion: z.string().max(500).optional(),
  precioBase: z.number().positive('El precio base debe ser positivo'),
  duracionMinutos: z.number().int().positive().default(60),
  categoriaId: z.number().int().positive().optional(),
});

export type CreateServicioInput = z.infer<typeof createServicioSchema>;

export const updateServicioSchema = createServicioSchema.partial();

export type UpdateServicioInput = z.infer<typeof updateServicioSchema>;

// ── Productos ───────────────────────────────────────────────

export const createProductoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150),
  marca: z.string().max(100).optional(),
  color: z.string().max(100).optional(),
  tamano: z.string().max(50).optional(),
  descripcion: z.string().max(500).optional(),
  urlFoto: z.string().max(500).optional(),
  precioCompra: z.number().min(0).default(0),
  precioVenta: z.number().min(0).default(0),
  cantidadStock: z.number().min(0).default(0),
  stockMinimo: z.number().min(0).default(0),
  tipoInventario: z.enum(['RETAIL', 'INTERNAL']).default('RETAIL'),
});

export type CreateProductoInput = z.infer<typeof createProductoSchema>;

export const updateProductoSchema = createProductoSchema.partial();

export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;

export const descontarStockSchema = z.object({
  cantidad: z.number().positive('La cantidad debe ser positiva'),
});

export type DescontarStockInput = z.infer<typeof descontarStockSchema>;

export const reabastecerStockSchema = z.object({
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  precioCompra: z.number().min(0).optional(),
});

export type ReabastecerStockInput = z.infer<typeof reabastecerStockSchema>;

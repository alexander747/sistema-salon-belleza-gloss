export { loginSchema, refreshSchema, createUsuarioSchema } from './auth.schema.js';
export type { LoginInput, RefreshInput } from './auth.schema.js';
export { createSalonSchema, updateSalonSchema } from './salon.schema.js';
export type { CreateSalonInput } from './salon.schema.js';
export { paginationSchema, idParamSchema } from './common.schema.js';
export type { PaginationInput } from './common.schema.js';
export {
  createCategoriaSchema,
  updateCategoriaSchema,
  createServicioSchema,
  updateServicioSchema,
  createProductoSchema,
  updateProductoSchema,
  descontarStockSchema,
  reabastecerStockSchema,
  restockProductoSchema,
} from './catalogo.schema.js';
export type {
  CreateCategoriaInput,
  UpdateCategoriaInput,
  CreateServicioInput,
  UpdateServicioInput,
  CreateProductoInput,
  UpdateProductoInput,
  DescontarStockInput,
  ReabastecerStockInput,
  RestockProductoInput,
} from './catalogo.schema.js';
export {
  createEmpleadaSchema,
  updateEmpleadaSchema,
  createClienteSchema,
  updateClienteSchema,
} from './personas.schema.js';
export type {
  CreateEmpleadaInput,
  UpdateEmpleadaInput,
  CreateClienteInput,
  UpdateClienteInput,
} from './personas.schema.js';
export {
  createCitaSchema,
  cambiarEstadoSchema,
  disponibilidadQuerySchema,
  createBloqueoSchema,
  updateHorariosSchema,
} from './agenda.schema.js';
export type {
  CreateCitaInput,
  CambiarEstadoInput,
  DisponibilidadQueryInput,
  CreateBloqueoInput,
  UpdateHorariosInput,
} from './agenda.schema.js';
export {
  crearPrestamoSchema,
  registrarPagoSchema,
  editarPrestamoSchema,
} from './prestamos.schema.js';
export type {
  CrearPrestamoInput,
  RegistrarPagoInput,
  EditarPrestamoInput,
} from './prestamos.schema.js';
export {
  createRegistroSchema,
  pagoTransaccionSchema,
  divisionRegistroSchema,
  createGastoSchema,
  createDevolucionSchema,
  liquidarEmpleadaSchema,
} from './finanzas.schema.js';
export type {
  CreateRegistroInput,
  PagoTransaccionInput,
  DivisionRegistroInput,
  CreateGastoInput,
  CreateDevolucionInput,
  LiquidarEmpleadaInput,
} from './finanzas.schema.js';

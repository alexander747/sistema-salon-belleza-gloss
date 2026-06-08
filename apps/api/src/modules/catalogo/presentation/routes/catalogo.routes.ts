import { Router } from 'express';
import { container } from 'tsyringe';
import { CategoriaController } from '../controllers/CategoriaController';
import { ServicioController } from '../controllers/ServicioController';
import { ProductoController } from '../controllers/ProductoController';
import { validate } from '../../../../presentation/middleware/validate';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { Rol } from '@pos-final/types';
import {
  createCategoriaSchema,
  updateCategoriaSchema,
  createServicioSchema,
  updateServicioSchema,
  createProductoSchema,
  updateProductoSchema,
  descontarStockSchema,
  reabastecerStockSchema,
  restockProductoSchema,
} from '@pos-final/validation';

const router = Router({ mergeParams: true });

const categoriaController = container.resolve(CategoriaController);
const servicioController = container.resolve(ServicioController);
const productoController = container.resolve(ProductoController);

// ── Categorías ──────────────────────────────────────────────

router.get('/categorias', categoriaController.list);
router.post(
  '/categorias',
  validate(createCategoriaSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  categoriaController.create,
);
router.put(
  '/categorias/:id',
  validate(updateCategoriaSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  categoriaController.update,
);
router.delete(
  '/categorias/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  categoriaController.delete,
);

// ── Servicios ───────────────────────────────────────────────

router.get('/servicios', servicioController.list);
router.get('/servicios/:id', servicioController.get);
router.post(
  '/servicios',
  validate(createServicioSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  servicioController.create,
);
router.put(
  '/servicios/:id',
  validate(updateServicioSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  servicioController.update,
);
router.delete(
  '/servicios/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  servicioController.delete,
);

// ── Productos ────────────────────────────────────────────────

router.get('/productos', productoController.list);
router.get('/productos/:id', productoController.get);
router.post(
  '/productos',
  validate(createProductoSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  productoController.create,
);
router.put(
  '/productos/:id',
  validate(updateProductoSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  productoController.update,
);
router.post(
  '/productos/:id/descontar',
  validate(descontarStockSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  productoController.descontar,
);
router.post(
  '/productos/:id/reabastecer',
  validate(reabastecerStockSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  productoController.reabastecer,
);
router.post(
  '/productos/:id/restock',
  validate(restockProductoSchema),
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  productoController.restock,
);
router.get(
  '/productos/:id/historial-precios',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR),
  productoController.historialPrecios,
);
router.delete(
  '/productos/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  productoController.delete,
);

export { router as catalogoRouter };

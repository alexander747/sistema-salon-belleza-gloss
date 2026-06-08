import { Router } from 'express';
import { container } from 'tsyringe';
import { PrestamoController } from '../controllers/PrestamoController';
import { validate } from '../../../../presentation/middleware/validate';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { Rol } from '@pos-final/types';
import { crearPrestamoSchema, registrarPagoSchema, editarPrestamoSchema } from '@pos-final/validation';

const router = Router({ mergeParams: true });

const prestamoController = container.resolve(PrestamoController);

// ── Préstamos ────────────────────────────────────────────────

router.get('/prestamos', prestamoController.list);

// ── Préstamos por empleado (MUST be before :id) ─────────────

router.get(
  '/prestamos/empleado/:usuarioId',
  prestamoController.prestamosPorEmpleado,
);

router.post(
  '/prestamos',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(crearPrestamoSchema),
  prestamoController.create,
);

router.get('/prestamos/:id', prestamoController.get);

router.put(
  '/prestamos/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(editarPrestamoSchema),
  prestamoController.update,
);

router.delete(
  '/prestamos/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  prestamoController.cancelar,
);

// ── Pagos ────────────────────────────────────────────────────

router.post(
  '/prestamos/:id/pagos',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(registrarPagoSchema),
  prestamoController.registrarPago,
);

export { router as prestamoRouter };

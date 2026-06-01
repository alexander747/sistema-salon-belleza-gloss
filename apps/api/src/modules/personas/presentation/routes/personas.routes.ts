import { Router } from 'express';
import { container } from 'tsyringe';
import { EmpleadaController } from '../controllers/EmpleadaController';
import { ClienteController } from '../controllers/ClienteController';
import { validate } from '../../../../presentation/middleware/validate';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { Rol } from '@pos-final/types';
import {
  createEmpleadaSchema,
  updateEmpleadaSchema,
  createClienteSchema,
  updateClienteSchema,
} from '@pos-final/validation';

const router = Router({ mergeParams: true });

const empleadaController = container.resolve(EmpleadaController);
const clienteController = container.resolve(ClienteController);

// ── Empleadas ────────────────────────────────────────────────

router.get('/empleadas', requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR), empleadaController.list);
router.get('/empleadas/:id', requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR), empleadaController.get);
router.post(
  '/empleadas',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(createEmpleadaSchema),
  empleadaController.create,
);
router.put(
  '/empleadas/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(updateEmpleadaSchema),
  empleadaController.update,
);
router.patch(
  '/empleadas/:id/activar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  empleadaController.activate,
);
router.patch(
  '/empleadas/:id/desactivar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  empleadaController.deactivate,
);

// ── Clientes ──────────────────────────────────────────────────

router.get('/clientes', requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA, Rol.MANICURISTA), clienteController.list);
router.get('/clientes/:id', requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA, Rol.MANICURISTA), clienteController.get);
router.post(
  '/clientes',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(createClienteSchema),
  clienteController.create,
);
router.put(
  '/clientes/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(updateClienteSchema),
  clienteController.update,
);

export { router as personasRouter };

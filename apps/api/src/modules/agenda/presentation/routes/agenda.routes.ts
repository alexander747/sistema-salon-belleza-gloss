import { Router } from 'express';
import { container } from 'tsyringe';
import { CitaController } from '../controllers/CitaController';
import { DisponibilidadController } from '../controllers/DisponibilidadController';
import { BloqueoController } from '../controllers/BloqueoController';
import { HorarioController } from '../controllers/HorarioController';
import { validate } from '../../../../presentation/middleware/validate';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { Rol } from '@pos-final/types';
import {
  createCitaSchema,
  cambiarEstadoSchema,
  createBloqueoSchema,
  updateHorariosSchema,
} from '@pos-final/validation';

const router = Router({ mergeParams: true });

const citaController = container.resolve(CitaController);
const disponibilidadController = container.resolve(DisponibilidadController);
const bloqueoController = container.resolve(BloqueoController);
const horarioController = container.resolve(HorarioController);

// ── Citas ──────────────────────────────────────────────────

router.get('/agenda/citas', citaController.list);
router.post(
  '/agenda/citas',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(createCitaSchema),
  citaController.create,
);
router.get('/agenda/citas/:id', citaController.get);
router.patch(
  '/agenda/citas/:id/estado',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(cambiarEstadoSchema),
  citaController.cambiarEstado,
);
router.post(
  '/agenda/citas/:id/cancelar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  citaController.cancelar,
);
router.post(
  '/agenda/citas/:id/completar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  citaController.completar,
);

// ── Disponibilidad ─────────────────────────────────────────

router.get('/agenda/disponibilidad', disponibilidadController.verificar);
router.get('/agenda/disponibilidad/slots', disponibilidadController.obtenerSlots);

// ── Bloqueos ───────────────────────────────────────────────

router.get('/agenda/bloqueos', bloqueoController.list);
router.post(
  '/agenda/bloqueos',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(createBloqueoSchema),
  bloqueoController.create,
);
router.delete(
  '/agenda/bloqueos/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  bloqueoController.delete,
);

// ── Horarios ───────────────────────────────────────────────

router.get('/agenda/horarios', horarioController.get);
router.put(
  '/agenda/horarios',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  validate(updateHorariosSchema),
  horarioController.upsert,
);

export { router as agendaRouter };

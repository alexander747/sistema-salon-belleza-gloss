import { Router } from 'express';
import { container } from 'tsyringe';
import { RegistroController } from '../controllers/RegistroController';
import { GastoController } from '../controllers/GastoController';
import { DevolucionController } from '../controllers/DevolucionController';
import { LiquidacionController } from '../controllers/LiquidacionController';
import { ReporteController } from '../controllers/ReporteController';
import { validate } from '../../../../presentation/middleware/validate';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { Rol } from '@pos-final/types';
import { createRegistroSchema } from '@pos-final/validation';

const router = Router({ mergeParams: true });

const registroController = container.resolve(RegistroController);
const gastoController = container.resolve(GastoController);
const devolucionController = container.resolve(DevolucionController);
const liquidacionController = container.resolve(LiquidacionController);
const reporteController = container.resolve(ReporteController);

// ── Registros ─────────────────────────────────────────────────

router.get('/registros', registroController.list);
router.post(
  '/registros',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(createRegistroSchema),
  registroController.create,
);
router.get('/registros/:id', registroController.get);
router.delete(
  '/registros/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  registroController.anular,
);

// ── Gastos ────────────────────────────────────────────────────

router.get('/gastos', gastoController.list);
router.post(
  '/gastos',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  gastoController.create,
);
router.delete(
  '/gastos/:id',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  gastoController.delete,
);

// ── Devoluciones ──────────────────────────────────────────────

router.get('/devoluciones', devolucionController.list);
router.post(
  '/devoluciones',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  devolucionController.create,
);

// ── Liquidación / Nómina ──────────────────────────────────────

router.get('/finanzas/nomina', liquidacionController.nominaPendiente);
router.post(
  '/finanzas/nomina/liquidar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  liquidacionController.liquidarEmpleada,
);
router.get('/finanzas/nomina/historial', liquidacionController.historial);

// ── Reportes ───────────────────────────────────────────────────

router.get('/finanzas/resumen', reporteController.resumenDia);
router.get('/finanzas/roi', reporteController.roiMensual);
router.get('/finanzas/turno/:id', reporteController.cierreTurno);

export { router as finanzasRouter };

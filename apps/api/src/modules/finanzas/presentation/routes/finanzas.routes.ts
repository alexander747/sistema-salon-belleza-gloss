import { Router } from 'express';
import { container } from 'tsyringe';
import { RegistroController } from '../controllers/RegistroController';
import { GastoController } from '../controllers/GastoController';
import { DevolucionController } from '../controllers/DevolucionController';
import { LiquidacionController } from '../controllers/LiquidacionController';
import { ReporteController } from '../controllers/ReporteController';
import { CajaController } from '../controllers/CajaController';
import { CuentasController } from '../controllers/CuentasController';
import { validate } from '../../../../presentation/middleware/validate';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { Rol } from '@pos-final/types';
import { createRegistroSchema, abrirCajaSchema, cerrarCajaSchema, abonarDeudaSchema } from '@pos-final/validation';

const router = Router({ mergeParams: true });

const registroController = container.resolve(RegistroController);
const gastoController = container.resolve(GastoController);
const devolucionController = container.resolve(DevolucionController);
const liquidacionController = container.resolve(LiquidacionController);
const reporteController = container.resolve(ReporteController);
const cajaController = container.resolve(CajaController);
const cuentasController = container.resolve(CuentasController);

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
// Abono a deuda (fiado): roles iguales a POST /registros
router.post(
  '/registros/:id/pagos',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(abonarDeudaSchema),
  registroController.abonar,
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

router.get(
  '/finanzas/nomina',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR),
  liquidacionController.nominaPendiente,
);
router.post(
  '/finanzas/nomina/liquidar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR),
  liquidacionController.liquidarEmpleada,
);
router.get(
  '/finanzas/nomina/historial',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR),
  liquidacionController.historial,
);

// ── Cuentas por cobrar / pagar (read-only, deuda sensible) ────

router.get(
  '/finanzas/cuentas/cobrar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR),
  cuentasController.cobrar,
);
router.get(
  '/finanzas/cuentas/pagar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR),
  cuentasController.pagar,
);

// ── Reportes ───────────────────────────────────────────────────

router.get('/finanzas/resumen', reporteController.resumenDia);
router.get('/finanzas/roi', reporteController.roiMensual);
router.get('/finanzas/pyl', reporteController.pyl);
router.get(
  '/finanzas/mensual',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR),
  reporteController.resumenMensual,
);
router.get('/finanzas/exportar', reporteController.exportar);
router.get('/finanzas/turno/:id', reporteController.cierreTurno);

// ── Caja (apertura / cierre / arqueo) ─────────────────────────

router.post(
  '/caja/abrir',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(abrirCajaSchema),
  cajaController.abrir,
);
router.post(
  '/caja/cerrar',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  validate(cerrarCajaSchema),
  cajaController.cerrar,
);
router.post(
  '/caja/reabrir',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  cajaController.reabrir,
);
router.get(
  '/caja/actual',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  cajaController.actual,
);
router.get(
  '/caja/actual/esperado',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  cajaController.actualEsperado,
);
router.get(
  '/caja/cierres',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.RECEPCIONISTA),
  cajaController.cierres,
);
// Detalle read-only de un cierre (historial): incluye CONTADOR — no modifica nada
router.get(
  '/caja/:id/cierre',
  requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR, Rol.RECEPCIONISTA),
  cajaController.detalleCierre,
);

export { router as finanzasRouter };

import { Router } from 'express';
import { container } from 'tsyringe';
import { SalonN8nController } from '../controllers/SalonN8nController';
import { CajaController } from '../../../../modules/finanzas/presentation/controllers/CajaController';
import { apiKeyGuard } from '../../../../presentation/middleware/apiKeyGuard';
import { tenantGuard } from '../../../../presentation/middleware/tenantGuard';

const router = Router();
const controller = container.resolve(SalonN8nController);
const cajaController = container.resolve(CajaController);

router.get('/:salonId/salon', apiKeyGuard, tenantGuard, controller.getSalon);
router.get('/:salonId/health', controller.healthCheck);

// ── Caja mirrors (mismos handlers → mismo shape {ok,data,error}) ──
// req.user es undefined en n8n → auditores apertura/cierre quedan null (columnas nullable)
router.get('/:salonId/caja/actual', apiKeyGuard, tenantGuard, cajaController.actual);
router.get('/:salonId/caja/actual/esperado', apiKeyGuard, tenantGuard, cajaController.actualEsperado);
router.post('/:salonId/caja/abrir', apiKeyGuard, tenantGuard, cajaController.abrir);
router.post('/:salonId/caja/cerrar', apiKeyGuard, tenantGuard, cajaController.cerrar);
router.get('/:salonId/caja/cierres', apiKeyGuard, tenantGuard, cajaController.cierres);

export { router as n8nRouter };

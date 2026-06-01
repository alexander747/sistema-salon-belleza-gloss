import { Router } from 'express';
import { container } from 'tsyringe';
import { SalonN8nController } from '../controllers/SalonN8nController';
import { apiKeyGuard } from '../../../../presentation/middleware/apiKeyGuard';
import { tenantGuard } from '../../../../presentation/middleware/tenantGuard';

const router = Router();
const controller = container.resolve(SalonN8nController);

router.get('/:salonId/salon', apiKeyGuard, tenantGuard, controller.getSalon);
router.get('/:salonId/health', controller.healthCheck);

export { router as n8nRouter };

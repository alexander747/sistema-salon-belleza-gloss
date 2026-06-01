import { Router } from 'express';
import { container } from 'tsyringe';
import { SalonSuperadminController } from '../controllers/SalonSuperadminController';
import { authGuard } from '../../../../presentation/middleware/authGuard';
import { requireRole } from '../../../../presentation/middleware/requireRole';
import { validate } from '../../../../presentation/middleware/validate';
import { createSalonSchema, updateSalonSchema } from '@pos-final/validation';
import { Rol } from '@pos-final/types';

const router = Router();
const controller = container.resolve(SalonSuperadminController);

router.post('/salones', authGuard, requireRole(Rol.SUPERADMIN), validate(createSalonSchema), controller.create);
router.get('/salones', authGuard, requireRole(Rol.SUPERADMIN), controller.list);
router.get('/salones/:id', authGuard, requireRole(Rol.SUPERADMIN), controller.getById);
router.put('/salones/:id', authGuard, requireRole(Rol.SUPERADMIN), validate(updateSalonSchema), controller.update);
router.patch('/salones/:id/toggle', authGuard, requireRole(Rol.SUPERADMIN), controller.toggle);
router.delete('/salones/:id', authGuard, requireRole(Rol.SUPERADMIN), controller.delete);

export { router as superadminRouter };

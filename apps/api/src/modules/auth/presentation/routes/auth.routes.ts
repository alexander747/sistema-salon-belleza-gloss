import { Router } from 'express';
import { container } from 'tsyringe';
import { AuthController } from '../controllers/AuthController';
import { validate } from '../../../../presentation/middleware/validate';
import { authGuard } from '../../../../presentation/middleware/authGuard';
import { loginSchema, refreshSchema } from '@pos-final/validation';

const router = Router();
const controller = container.resolve(AuthController);

router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.get('/me', authGuard, controller.me);

export { router as authRouter };

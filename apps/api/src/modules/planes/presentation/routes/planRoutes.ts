import { Router } from 'express';
import { container } from 'tsyringe';
import { PlanController } from '../controllers/PlanController';

const planController = container.resolve(PlanController);

const router = Router();

router.get('/', (req, res) => planController.list(req, res));
router.get('/:id', (req, res) => planController.getById(req, res));
router.post('/', (req, res) => planController.create(req, res));
router.put('/:id', (req, res) => planController.update(req, res));
router.delete('/:id', (req, res) => planController.delete(req, res));

export default router;

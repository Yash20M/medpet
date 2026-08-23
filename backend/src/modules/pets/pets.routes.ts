import { Router } from 'express';
import { PetsController } from './pets.controller';
import { createPetValidator, updatePetValidator } from './pets.validator';
import { protect } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(protect);

router.get('/', PetsController.list);
router.get('/:id', PetsController.getOne);
router.post('/', createPetValidator, validate, PetsController.create);
router.patch('/:id', updatePetValidator, validate, PetsController.update);
router.delete('/:id', PetsController.remove);

export default router;

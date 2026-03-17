import { Router } from 'express';
import { verifyAccess } from '../controllers/device.controller.js';
import { verifyDeviceSignature } from '../middleware/hmacAuth.middleware.js';

const router = Router();

router.post('/verify', verifyDeviceSignature, verifyAccess);

export default router;
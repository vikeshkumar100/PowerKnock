import { Router } from 'express';
import { verifyAccess, getLogs } from '../controllers/device.controller.js';
import { verifyDeviceSignature } from '../middleware/hmacAuth.middleware.js';

const router = Router();

router.post('/verify', verifyDeviceSignature, verifyAccess);
router.get('/logs', getLogs);

export default router;
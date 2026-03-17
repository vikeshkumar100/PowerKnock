import Device from '../models/device.model.js';
import {
    buildDeviceMessage,
    compareHmacSignatures,
    generateHmacSHA256,
} from '../utils/hmac.js';

const MAX_TIMESTAMP_AGE_MS = 30 * 1000;

const unauthorized = (res) => {
    return res.status(401).json({
        success: false,
        message: 'Unauthorized',
    });
};

export const verifyDeviceSignature = async (req, res, next) => {
    try {
        const { deviceId, rfid, knockCount, timestamp, signature } = req.body;

        if (!deviceId || !rfid || knockCount === undefined || timestamp === undefined || !signature) {
            return unauthorized(res);
        }

        if (!Number.isInteger(knockCount)) {
            return unauthorized(res);
        }

        const requestTimestamp = Number(timestamp);

        if (!Number.isFinite(requestTimestamp) || !Number.isInteger(requestTimestamp)) {
            return unauthorized(res);
        }

        const device = await Device.findOne({ deviceId });

        if (!device) {
            return unauthorized(res);
        }

        const now = Date.now();

        if (now - requestTimestamp > MAX_TIMESTAMP_AGE_MS) {
            return unauthorized(res);
        }

        const timestampValue = String(timestamp);
        const message = buildDeviceMessage({
            deviceId,
            rfid,
            knockCount,
            timestamp: timestampValue,
        });

        const expectedSignature = generateHmacSHA256(message, device.secretKey);

        if (!compareHmacSignatures(signature, expectedSignature)) {
            return unauthorized(res);
        }

        req.device = device;
        req.devicePayload = {
            deviceId,
            rfid,
            knockCount,
            timestamp: timestampValue,
            signature,
        };

        next();
    } catch (err) {
        next(err);
    }
};
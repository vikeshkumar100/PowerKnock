import Device from '../models/device.model.js';
import Log from '../models/log.model.js';
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

const saveFailedLog = (deviceId, rfid, knockCount, reason) => {
    Log.create({ deviceId, rfid, knockCount, status: 'denied', reason }).catch((err) =>
        console.error('Failed to save log:', err.message)
    );
};

export const verifyDeviceSignature = async (req, res, next) => {
    try {
        const { deviceId, rfid, knockCount, timestamp, signature } = req.body;

        if (!deviceId || !rfid || knockCount === undefined || timestamp === undefined || !signature) {
            saveFailedLog(deviceId, rfid, knockCount, 'missing required fields');
            return unauthorized(res);
        }

        if (!Number.isInteger(knockCount)) {
            saveFailedLog(deviceId, rfid, knockCount, 'invalid knock count');
            return unauthorized(res);
        }

        const requestTimestamp = Number(timestamp);

        if (!Number.isFinite(requestTimestamp) || !Number.isInteger(requestTimestamp)) {
            saveFailedLog(deviceId, rfid, knockCount, 'invalid timestamp');
            return unauthorized(res);
        }

        const device = await Device.findOne({ deviceId });

        if (!device) {
            saveFailedLog(deviceId, rfid, knockCount, 'device not found');
            return unauthorized(res);
        }

        const now = Date.now();
        const clockSkewMs = Math.abs(now - requestTimestamp);

        if (clockSkewMs > MAX_TIMESTAMP_AGE_MS) {
            saveFailedLog(deviceId, rfid, knockCount, 'invalid timestamp window');
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
            saveFailedLog(deviceId, rfid, knockCount, 'invalid signature');
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
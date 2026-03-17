import crypto from 'crypto';

export const buildDeviceMessage = ({ deviceId, rfid, knockCount, timestamp }) => {
    return `${deviceId}|${rfid}|${knockCount}|${timestamp}`;
};

export const generateHmacSHA256 = (message, secretKey) => {
    return crypto
        .createHmac('sha256', secretKey)
        .update(message)
        .digest('hex');
};

export const compareHmacSignatures = (providedSignature, expectedSignature) => {
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};
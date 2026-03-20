import Student from '../models/student.model.js';
import Log from '../models/log.model.js';

const saveLog = (deviceId, rfid, knockCount, status, reason = null) => {
    Log.create({ deviceId, rfid, knockCount, status, reason }).catch((err) =>
        console.error('Failed to save log:', err.message)
    );
};

export const verifyAccess = async (req, res, next) => {
    try {
        const { deviceId, rfid, knockCount } = req.devicePayload;

        const student = await Student.findOne({ rfidTag: rfid });

        if (!student) {
            saveLog(deviceId, rfid, knockCount, 'denied', 'student not found');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (student.device.toString() !== req.device._id.toString()) {
            saveLog(deviceId, rfid, knockCount, 'denied', 'device mismatch');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (student.knockPattern !== knockCount) {
            saveLog(deviceId, rfid, knockCount, 'denied', 'wrong knock pattern');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        saveLog(deviceId, rfid, knockCount, 'granted');
        return res.status(200).json({
            success: true,
            message: 'Access granted',
        });
    } catch (err) {
        next(err);
    }
};

export const getLogs = async (req, res, next) => {
    try {
        const { deviceId, status, limit = 100 } = req.query;

        const filter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (status) filter.status = status;

        const logs = await Log.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit));

        return res.status(200).json({
            success: true,
            count: logs.length,
            logs,
        });
    } catch (err) {
        next(err);
    }
};
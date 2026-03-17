import Student from '../models/student.model.js';

export const verifyAccess = async (req, res, next) => {
    try {
        const { rfid, knockCount } = req.devicePayload;

        const student = await Student.findOne({ rfidTag: rfid });

        if (!student) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (student.device.toString() !== req.device._id.toString()) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (student.knockPattern !== knockCount) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Access granted',
        });
    } catch (err) {
        next(err);
    }
};
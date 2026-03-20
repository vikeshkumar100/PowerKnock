import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        default: 'unknown',
    },
    rfid: {
        type: String,
        default: 'unknown',
    },
    knockCount: {
        type: Number,
        default: null,
    },
    status: {
        type: String,
        enum: ['granted', 'denied'],
        required: true,
    },
    reason: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

const Log = mongoose.model('Log', logSchema);

export default Log;

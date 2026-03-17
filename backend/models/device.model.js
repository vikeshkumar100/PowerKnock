import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    secretKey: {
        type: String,
        required: true,
        trim: true,
    },
    roomName: {
        type: String,
        required: true,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Device = mongoose.model('Device', deviceSchema);

export default Device;
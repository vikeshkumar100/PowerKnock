import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    rfidTag: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    knockPattern: {
        type: Number,
        required: true,
        min: 0,
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true,
    },
}, {
    timestamps: true,
});

const Student = mongoose.model('Student', studentSchema);

export default Student;
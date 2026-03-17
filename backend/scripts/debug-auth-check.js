import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const dbUrl = (process.env.DB_URL || '').replaceAll('"', '');

const deviceSchema = new mongoose.Schema({
  deviceId: String,
  secretKey: String,
  roomName: String,
  createdAt: Date,
}, { collection: 'devices' });

const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  rfidTag: String,
  knockPattern: Number,
  device: mongoose.Schema.Types.ObjectId,
  createdAt: Date,
  updatedAt: Date,
}, { collection: 'students' });

const Device = mongoose.model('DeviceDebugScript', deviceSchema);
const Student = mongoose.model('StudentDebugScript', studentSchema);

const run = async () => {
  await mongoose.connect(dbUrl);

  const payload = {
    deviceId: 'door-device-01',
    rfid: '1A87CA62',
    knockCount: 2,
    timestamp: String(Date.now()),
  };

  const message = `${payload.deviceId}|${payload.rfid}|${payload.knockCount}|${payload.timestamp}`;
  payload.signature = crypto.createHmac('sha256', 'vikesh.dev').update(message).digest('hex');

  const device = await Device.findOne({ deviceId: payload.deviceId }).lean();
  const student = await Student.findOne({ rfidTag: payload.rfid }).lean();

  const expectedSignature = device
    ? crypto.createHmac('sha256', device.secretKey).update(message).digest('hex')
    : null;

  const result = {
    payload,
    checks: {
      deviceFound: Boolean(device),
      studentFound: Boolean(student),
      signatureMatch: Boolean(expectedSignature && expectedSignature === payload.signature),
      studentDeviceMatch: Boolean(device && student && String(student.device) === String(device._id)),
      knockMatch: Boolean(student && student.knockPattern === payload.knockCount),
      isExpired: Date.now() - Number(payload.timestamp) > 30000,
    },
    device: device
      ? { id: String(device._id), deviceId: device.deviceId, secretKey: device.secretKey }
      : null,
    student: student
      ? { id: String(student._id), rfidTag: student.rfidTag, knockPattern: student.knockPattern, device: String(student.device) }
      : null,
  };

  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});

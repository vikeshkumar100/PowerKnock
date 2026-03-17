import mongoose from 'mongoose';
import dotenv from 'dotenv';

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

const Device = mongoose.model('DeviceSeedScript', deviceSchema);
const Student = mongoose.model('StudentSeedScript', studentSchema);

const seed = async () => {
  if (!dbUrl) {
    throw new Error('DB_URL missing in backend/.env');
  }

  await mongoose.connect(dbUrl);

  let device = await Device.findOne({ deviceId: 'door-device-01' });
  if (!device) {
    device = await Device.create({
      deviceId: 'door-device-01',
      secretKey: 'vikesh.dev',
      roomName: 'Main Door',
      createdAt: new Date(),
    });
  } else {
    device.secretKey = 'vikesh.dev';
    if (!device.roomName) {
      device.roomName = 'Main Door';
    }
    if (!device.createdAt) {
      device.createdAt = new Date();
    }
    await device.save();
  }

  await Student.findOneAndUpdate(
    { rfidTag: '1A87CA62' },
    {
      $set: {
        name: 'Test User',
        email: 'test.user@powerknock.local',
        rfidTag: '1A87CA62',
        knockPattern: 2,
        device: device._id,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  const student = await Student.findOne({ rfidTag: '1A87CA62' }).lean();

  console.log(JSON.stringify({
    success: true,
    device: {
      deviceId: device.deviceId,
      secretKey: device.secretKey,
      roomName: device.roomName,
      id: String(device._id),
    },
    student: {
      rfidTag: student.rfidTag,
      knockPattern: student.knockPattern,
      device: String(student.device),
    },
  }, null, 2));

  await mongoose.disconnect();
};

seed().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});

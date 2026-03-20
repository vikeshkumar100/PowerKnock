import express from 'express';
import dotenv from 'dotenv';
import { connectDb } from './config/connection.js';
import deviceRoutes from './routes/device.routes.js';

dotenv.config();
const PORT = process.env.PORT || 8000;
const DB_URL = process.env.DB_URL;
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'PowerKnock backend is running',
    });
});

app.use('/api/device', deviceRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});

const startServer = async () => {
    if (!DB_URL) {
        throw new Error('DB_URL is not configured');
    }

    await connectDb(DB_URL);

    app.listen(PORT, () => {
        console.log(`server is running on port - ${PORT}`);
    });
};

startServer().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});
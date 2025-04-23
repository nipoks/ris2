import express from 'express';
import dotenv from 'dotenv';

import { AppRoutes } from "./routes.js";
import {listenToQueues} from "./rabbit/listenToQueues.js";
import {connectToMongo} from "./config/db.js";
import {connectToRabbit} from "./rabbit/connection.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(AppRoutes);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await connectToMongo();
        await connectToRabbit();
        await listenToQueues();

        app.listen(PORT, () => {
            console.log(`Сервер запущен на порту ${PORT}`);
        });
    } catch (err) {
        console.error("Ошибка при старте приложения:", err);
    }
}

setTimeout(startServer, 10000);



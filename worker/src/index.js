import express from 'express';
import dotenv from 'dotenv';

import {connectToRabbit} from "./rabbit/connection.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

const startServer = async () => {
    try {
        await connectToRabbit();

        app.listen(PORT, () => {
            console.log(`Сервер запущен на порту ${PORT}`);
        });
    } catch (err) {
        console.error("Ошибка при старте приложения:", err);
    }
}

setTimeout(startServer, 10000);

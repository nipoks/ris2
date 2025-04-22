import express from 'express';
import dotenv from 'dotenv';

import { AppRoutes } from "./routes.js";
import {connectToRabbit} from "./rabbitConnection.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(AppRoutes);

const PORT = process.env.PORT || 4000;

await connectToRabbit()

app.listen(PORT, () => {
    console.log("Запущен на порту 4000");
});

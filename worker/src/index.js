import express from 'express';
import dotenv from 'dotenv';
import mongoose from "mongoose";

import { AppRoutes } from "./routes.js";
import {connectToRabbit} from "./rabbitConnection.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(AppRoutes);

const PORT = process.env.PORT || 4000;

await mongoose
    .connect(process.env.MONGO_URI, {
        dbName: process.env.DB_NAME,
        useNewUrlParser: true,
        useUnifiedTopology: true })
    .then(async () => {
        console.log("MongoDB connected")
    })
    .catch((err) => console.error("MongoDB connection error:", err));

await connectToRabbit()

app.listen(PORT, () => {
    console.log("Запущен на порту 4000");
});

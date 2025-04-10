import express from 'express';
import dotenv from 'dotenv';
import mongoose from "mongoose";

import { AppRoutes } from "./routes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(AppRoutes);

const PORT = process.env.PORT || 3000;

mongoose
    .connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME })
    .then(async () => {
    console.log("MongoDB connected")
})
    .catch((err) => console.error("MongoDB connection error:", err));


app.listen(PORT, () => {
    console.log("Запущен на порту 3000");
});

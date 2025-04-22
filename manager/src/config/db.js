import mongoose from 'mongoose';

export const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME,
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB подключен");
    } catch (err) {
        console.error("❌ Ошибка подключения к MongoDB:", err);
        throw err;
    }
};

import amqp from 'amqplib';

let channel = null;

export const connectToRabbit = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBIT_URI);
        channel = await connection.createChannel();
        console.log("🐰 Подключение к RabbitMQ установлено");
    } catch (err) {
        console.error("❌ Не удалось подключиться к RabbitMQ:", err);
        setTimeout(connectToRabbit, 10000);
        throw err;
    }
};

export const getRabbitChannel = () => channel;

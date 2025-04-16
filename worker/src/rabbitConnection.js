import amqp from 'amqplib';

let channel = null;
let connection = null;

export const connectToRabbit = async () => {
    try {
        connection = await amqp.connect(process.env.RABBIT_URI);
        channel = await connection.createChannel("" );
        console.log("🐰 RabbitMQ подключен");
    } catch (err) {
        console.error("❌ Ошибка подключения к RabbitMQ:", err);
        setTimeout(connectToRabbit, 10000);

    }
};

export const getRabbitChannel = () => channel;

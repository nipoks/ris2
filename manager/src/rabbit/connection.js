import amqp from 'amqplib';
import {resendUnsentPartTasks} from "./resendUnsentPartTasks.js";
import {listenToQueues} from "./listenToQueues.js";

let channel = null;

export const connectToRabbit = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBIT_URI);
        connection.on('close', () => {
            console.warn('RabbitMQ соединение закрыто. Попробуем переподключиться...');
            setTimeout(connectToRabbit, 5000);
        });
        connection.on('error', (err) => {
            console.error('Ошибка RabbitMQ соединения:', err.message);
        });

        channel = await connection.createChannel();
        console.log("Подключение к RabbitMQ установлено");
        await resendUnsentPartTasks();
        await listenToQueues()
    } catch (err) {
        console.error("Не удалось подключиться к RabbitMQ:", err);
        setTimeout(connectToRabbit, 10000);
    }
};

export const getRabbitChannel = () => channel;

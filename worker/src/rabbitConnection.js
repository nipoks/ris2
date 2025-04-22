import amqp from 'amqplib';
import {processTask} from "./controller.js";

let channel = null;
let connection = null;

export const connectToRabbit = async () => {
    try {
        connection = await amqp.connect(process.env.RABBIT_URI);
        channel = await connection.createChannel();
        console.log("🐰 RabbitMQ подключен");

        const QUEUE_NAME = "task_q";
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.prefetch(1);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                const { data } = JSON.parse(msg.content.toString());
                console.log(`📥 Получена задача: ${data.toString()}`);
                try {
                    await processTask(data);
                    channel.ack(msg);
                } catch (err) {
                    console.error("Ошибка обработки задачи, отправим в очередь снова");
                    channel.nack(msg); // можно nack с requeue: true
                }
            }
        });

    } catch (err) {
        console.error("❌ Ошибка подключения к RabbitMQ:", err);
        setTimeout(connectToRabbit, 10000);

    }
};

export const getRabbitChannel = () => channel;

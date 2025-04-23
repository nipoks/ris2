import {processTask} from "../controller.js";
import {getRabbitChannel} from "./connection.js";

export const listenToQueues = async () => {
    const channel = getRabbitChannel();

    const TASK_QUEUE = process.env.TASK_QUEUE;
    await channel.assertQueue(TASK_QUEUE, { durable: true });
    await channel.prefetch(1);
    console.log("Воркер слушает очередь задач:", TASK_QUEUE);

    channel.consume(TASK_QUEUE, async (msg) => {
        if (msg !== null) {
            const { data } = JSON.parse(msg.content.toString());
            console.log(`Получена задача: ${data.toString()}`);
            try {
                await processTask(data);
                channel.ack(msg);
            } catch (err) {
                console.error("Ошибка обработки задачи, отправим в очередь снова");
                if (channel.connection?.stream?.destroyed) {
                    console.warn("Соединение с Rabbit потеряно. Не будем делать NACK, задача вернётся сама.");
                    return;
                }

                try {
                    channel.nack(msg, false, true); // безопасный повтор
                } catch (nackErr) {
                    console.error("Ошибка при NACK:", nackErr.message);
                }
            }
        }
    });
};


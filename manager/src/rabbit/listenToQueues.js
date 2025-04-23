import {getRabbitChannel} from "./connection.js";
import {handlerAnswerFromWorker, handlerStatusFromWorker} from "../controller.js";

export const listenToQueues = async () => {
    try {
        const channel = getRabbitChannel();


        const ANSWER_QUEUE = process.env.ANSWER_QUEUE;
        const STATUS_QUEUE = process.env.STATUS_QUEUE;

        await channel.assertQueue(ANSWER_QUEUE, {durable: true});
        await channel.assertQueue(STATUS_QUEUE, {durable: true});

        await channel.prefetch(1);
        console.log("Менеджер слушает очередь ответов:", ANSWER_QUEUE);

        channel.consume(ANSWER_QUEUE, async (msg) => {
            if (msg !== null) {
                const {answer} = JSON.parse(msg.content.toString());
                try {
                    console.log("Получен ответ от воркера:", answer.idPartTask, answer.status, answer.found);
                    await handlerAnswerFromWorker(answer);
                    channel.ack(msg)
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

        channel.consume(STATUS_QUEUE, async (msg) => {
            if (msg !== null) {
                const answer = JSON.parse(msg.content.toString());
                try {
                    console.log("Получен статус по задаче от воркера:", answer);
                    await handlerStatusFromWorker(answer);

                    channel.ack(msg)
                } catch (err) {
                    console.error("Ошибка обработки статуса, отправим в очередь снова");
                    channel.nack(msg);
                }
            }
        });
    } catch (err) {
        console.error("Не удалось подключиться к RabbitMQ:", err);
        setTimeout(listenToQueues, 10000);
    }
};

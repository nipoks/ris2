import {getRabbitChannel} from "./connection.js";
import {handlerAnswerFromWorker} from "../controller.js";

export const listenToQueues = async () => {
    const channel = getRabbitChannel();

    const ANSWER_QUEUE = 'answer_q';
    const STATUS_QUEUE = 'status_q';

    await channel.assertQueue(ANSWER_QUEUE, { durable: true });
    await channel.assertQueue(STATUS_QUEUE, { durable: true });

    await channel.prefetch(1);
    console.log("🎧 Менеджер слушает очередь ответов:", ANSWER_QUEUE);

    channel.consume(ANSWER_QUEUE, async (msg) => {
        if (msg !== null) {
            const {answer} = JSON.parse(msg.content.toString());
            try {
                // setTimeout(async () => {
                    console.log("✅ Получен ответ от воркера:", answer.idPartTask, answer.status, answer.found);
                    await handlerAnswerFromWorker(answer);// записать в базу
                    channel.ack(msg) // подтвердить
                // }, 5000);
            } catch (err) {
                console.error("Ошибка обработки задачи, отправим в очередь снова");
                channel.nack(msg);
            }
        }
    });

    channel.consume(STATUS_QUEUE, async (msg) => {
        if (msg !== null) {
            const answer = JSON.parse(msg.content.toString());
            try {
                setTimeout(() => {
                    console.log("✅ Получен статус по задаче от воркера:", answer);
                    channel.ack(msg)
                }, 5000);
            } catch (err) {
                console.error("Ошибка обработки статуса, отправим в очередь снова");
                channel.nack(msg);
            }
        }
    });
};

import SharedMap from "sharedmap";
import { Worker } from "worker_threads";
import dotenv from "dotenv";
import {getRabbitChannel} from "./rabbit/connection.js";

dotenv.config();

const sharedMap = new SharedMap(10 * 1024 * 1024, 40, 8);

const ANSWER_QUEUE = process.env.ANSWER_QUEUE;
const STATUS_QUEUE = process.env.STATUS_QUEUE;


const lastSendTaskStatus = async (idPartTask) => {
    const channel = getRabbitChannel();

    await channel.assertQueue(STATUS_QUEUE, {durable: true});
    channel.sendToQueue(STATUS_QUEUE, Buffer.from(JSON.stringify({
        status: 'READY',
        idPartTask: idPartTask,
        percentComplete: 100
    })), {persistent: false});
    sharedMap.delete(idPartTask);
}

export function processTask(task) {
    return new Promise((resolve, reject) => {
        const { idPartTask, alphabet, partNumber, partCount, hash, maxLength } = task;

        const worker = new Worker('./src/worker.js');

        worker.postMessage({ idPartTask, alphabet, partNumber, partCount, hash, maxLength, sharedMap });



        let statusInterval = setInterval(async () => {
            try {
                const progress = sharedMap.get(idPartTask);
                if (progress !== null) {
                    const channel = getRabbitChannel();
                    await channel.assertQueue(STATUS_QUEUE, { durable: true });
                    channel.sendToQueue(STATUS_QUEUE, Buffer.from(JSON.stringify({
                        status: 'IN_PROGRESS',
                        idPartTask: idPartTask,
                        percentComplete: progress
                    })), { persistent: true });
                }
            } catch (err) {
                console.error(`Ошибка при отправке статуса задачи ${idPartTask}:`, err.message);
            }
        }, 5000); // каждые 5 секунд



        worker.on('message', async (data) => {
            clearInterval(statusInterval);

            const { found, idPartTask, status } = data;
            console.log(`Завершил обработку задачи ${idPartTask}. Найдено: ${found.length > 0 ? found : 'ничего'}`);
            const answer = {
                found: found.length > 0 ? JSON.parse(JSON.stringify(found)) : [],
                idPartTask: idPartTask,
                status: status
            };
            try {
                const channel = getRabbitChannel();
                if (!channel || channel.connection?.stream?.destroyed) {
                    throw new Error("RabbitMQ недоступен при отправке результата");
                }

                await channel.assertQueue(ANSWER_QUEUE, { durable: true });
                channel.sendToQueue(ANSWER_QUEUE, Buffer.from(JSON.stringify({answer})), { persistent: true });
                await lastSendTaskStatus(idPartTask)

                console.log(`Результат для задачи ${idPartTask} отправлен.`);
                resolve(); // Всё, задача выполнена
            } catch (error) {
                console.error(`Ошибка отправки результата задачи ${idPartTask}: ${error.message}`);
                reject(error);
            }
        });

        worker.on('error', (error) => {
            clearInterval(statusInterval);

            console.error(`Ошибка в worker для задачи ${idPartTask}: ${error.name} ${error.stack}`);
            reject(error);
        });

        worker.on('exit', (code) => {
            clearInterval(statusInterval);

            if (code !== 0) {
                reject(new Error(`Worker завершился с ошибкой, код: ${code}`));
            }
        });
    });
}

import SharedMap from "sharedmap";
import { Worker } from "worker_threads";
import axios from "axios";
import dotenv from "dotenv";
import {getRabbitChannel} from "./rabbitConnection.js";

dotenv.config();

let activeWorkers = 0;
let taskQueue = [];
const sharedMap = new SharedMap(10 * 1024 * 1024, 40, 8);

const MANAGER = process.env.MANAGER
//const QUEUE_NAME = `${process.env.WORKER_NAME}_queue`;

function handleTaskQueue() {
    if (taskQueue.length > 0 && activeWorkers < 2) {
        const task = taskQueue.shift();
        activeWorkers++;
        processTask(task);
    }
}

export function processTask(task) {
    return new Promise((resolve, reject) => {
        const { idPartTask, alphabet, partNumber, partCount, hash, maxLength } = task;

        const worker = new Worker('./src/worker.js');

        worker.postMessage({ idPartTask, alphabet, partNumber, partCount, hash, maxLength, sharedMap });

        worker.on('message', async (data) => {
            const { found, idPartTask, status } = data;
            console.log(`Завершил обработку задачи ${idPartTask}. Найдено: ${found.length > 0 ? found : 'ничего'}`);
            const answer = {
                found: found.length > 0 ? JSON.parse(JSON.stringify(found)) : [],
                idPartTask: idPartTask,
                status: status
            };
            try {
                //await axios.patch(`${MANAGER}/internal/api/manager/hash/crack/request`, answer);
                const channel = getRabbitChannel();
                const ANSWER_QUEUE = 'answer_q';
                await channel.assertQueue(ANSWER_QUEUE, { durable: true });
                channel.sendToQueue(ANSWER_QUEUE, Buffer.from(JSON.stringify({answer})), { persistent: true });

                console.log(`Результат для задачи ${idPartTask} отправлен.`);
                resolve(); // ✅ Всё, задача выполнена
            } catch (error) {
                console.error(`Ошибка отправки результата задачи ${idPartTask}: ${error.message}`);
                reject(error); // ❌ Ошибка — чтоб Rabbit повторил
            }
        });

        worker.on('error', (error) => {
            console.error(`Ошибка в worker для задачи ${idPartTask}: ${error.name} ${error.stack}`);
            reject(error);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker завершился с ошибкой, код: ${code}`));
            }
        });
    });
}

export const postNewTask = async (req, res) => {
    const { idPartTask, alphabet, partNumber, partCount, hash, maxLength } = req.body;

    if (!idPartTask) {
        return res.status(400).json({ error: "Invalid task data" });
    }
    /////////////
    const channel = getRabbitChannel();
    const QUEUE_NAME = "task_q";

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.consume(
        QUEUE_NAME,
        (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                console.log(`📥 [${QUEUE_NAME}] Получено сообщение:`, content);
                // Обработка данных...
                channel.ack(msg);
            }
        },
        { noAck: false }
    );
    ////////////////
    if (activeWorkers < 2) {
        ++activeWorkers;
        processTask({ idPartTask, alphabet, partNumber, partCount, hash, maxLength });
        console.log(`Часть задачи = ${idPartTask} отправлена на выполнение.`);
        return res.status(200).json({ message: "Работа запущена" });
    } else {
        taskQueue.push({ idPartTask });
        console.log(`Часть задачи ${idPartTask} поставлена в очередь.`);
        return res.status(200).json({ message: "Работа в очереди" });
    }
}

export const getTaskStatus = (req, res) => {
    const { requestId } = req.params;
    const progress = sharedMap.get(requestId)
    console.log(`${progress}%  id= ${requestId}`)
    if (progress !== null) {
        return res.json({ requestId, progress });
    } else {
        return res.status(404).json({ error: "Прогресс для этого requestId не найден" });
    }
}
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
const QUEUE_NAME = `${process.env.WORKER_NAME}_queue`;

function handleTaskQueue() {
    if (taskQueue.length > 0 && activeWorkers < 2) {
        const task = taskQueue.shift();
        activeWorkers++;
        processTask(task);
    }
}

async function processTask(task) {
    const { idPartTask } = task;
    let workerIndex
    console.log(idPartTask);

    const worker = new Worker('./src/worker.js');

    worker.postMessage({ idPartTask });

    worker.on('message', async (data) => {
        const { found, partNumber, status, taskId } = data;
        console.log(`Завершил обработку задачи ${idPartTask}. Найдено: ${found.length > 0 ? found : 'ничего'}`);
        const answer = {
            partNumber: partNumber,
            found: found.length > 0 ? JSON.parse(JSON.stringify(found)) : [],
            idPartTask: idPartTask,
            status: status,
            taskId: taskId,
        }
        console.log(answer);
        try {
            await axios.patch(`${MANAGER}/internal/api/manager/hash/crack/request`, answer);
            console.log(`Результат для задачи ${idPartTask} отправлен.`);
        } catch (error) {
            console.error(`Ошибка отправки результата задачи ${idPartTask}: ${error.message}`);
        }
        --activeWorkers;
        handleTaskQueue();
    });

    worker.on('error', (error) => {
        console.error(`Ошибка в worker для задачи ${idPartTask}: ${error.name} ${error.stack} ${error.cause}`);
        activeWorkers--;
        handleTaskQueue();
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker завершился с ошибкой для задачи ${idPartTask}, код: ${code}`);
        }
    });
}

export const postNewTask = async (req, res) => {
    const { idPartTask } = req.body;

    if (!idPartTask) {
        return res.status(400).json({ error: "Invalid task data" });
    }
    /////////////
    const channel = getRabbitChannel();
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
        processTask({ idPartTask });
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
import axios from 'axios';
import {v4 as uuidv4} from "uuid";
import dotenv from "dotenv";
import Task from "./models/task.js";
import PartTask from "./models/partTask.js";
import {getRabbitChannel} from "./rabbitConnection.js";

dotenv.config();

const WORKERS = process.env.WORKERS ? process.env.WORKERS.split(',') : [];
const WORKERS_QUEUES = process.env.WORKERS_QUEUES ? process.env.WORKERS_QUEUES.split(',') : [];
let requests = {};
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const getTaskStatus = async (req, res) => {
    const {requestId} = req.query;
    if (!requestId) {
        return res.status(400).json({error: "Invalid requestId"});
    }
    let progress = 0
    for (let i = 0; i < WORKERS.length; i++) {
        await axios.get(`${WORKERS[i]}/internal/api/worker/progress/${requestId}`)
            .then(response => {
                progress += parseInt(response.data.progress)
            })
            .catch(error => {
                console.log(`Error: worker${WORKERS[i]} - ${error.response.data.error}`);
            })
    }

    progress = Math.floor(progress / WORKERS.length);
    console.log(progress);

    let countReady = 0
    let countError = 0
    let answer = []

    for (let i = 1; i <= WORKERS.length; i++) {
        const status = requests[requestId + i].status;
        switch (status) {
            case 'IN_PROGRESS':    // хоть 1 InProgress - в ответ IP
                return res.json({
                    status: 'IN_PROGRESS',
                    data: {
                        answer: null,
                        progress: `${progress}%`
                    }
                });
            case 'READY':
                countReady += 1
                const answerI = requests[requestId + i].found
                if (answerI !== null) {
                    answer.push(answerI)
                }
                break;
            case 'ERROR':
                countError += 1
                break;
            default:
                break;
        }
    }

    if (countReady === WORKERS.length) {
        return res.json({
            status: 'READY',
            data: {
                answer: answer,
                progress: `100%`
            }
        });
    }

    if (countError > 0) {
        if (answer.length > 0) { // если есть error но хоть 1 ответ не пустой - ответ PART_ANSWER_IS_READY 'abcd'
            return res.json({
                status: 'PART_ANSWER_IS_READY',
                data: {
                    answer: answer,
                    progress: `${progress}%`
                }
            });
        }

        return res.json({
            status: 'ERROR',
            data: null
        });
    }

    return res.json({
        status: 'I_D\'NOT_NO',
        data: null
    });
}

export const postTaskToWorkers = async (req, res) => {
    const { hash, maxLength } = req.body;
    if (!hash || !maxLength) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    const requestId = uuidv4();

    console.log(`Новый запрос: ${requestId}`);

    const newTask = new Task({
        hash,
        maxLength,
        idTask: requestId,
        status: 'CREATE',
        found: [],
        percentComplete: 0,
        alphabet: alphabet
    })
    await newTask.save()
    const channel = getRabbitChannel();

    for (let index = 0; index < WORKERS.length; index++) {
        requests[requestId + (index + 1)] = {
            status: 'PENDING',
            found: null
        };
        const partTask = new PartTask({
            idTask: newTask.idTask,
            idWorker: index,
            found: [],
            status: 'CREATE',
            percentComplete: 0,
            partNumber: index + 1,
            partCount: WORKERS.length,
            alphabet: alphabet,
            hash: newTask.hash,
            maxLength: newTask.maxLength,
        })
        await partTask.save()
        ////
        const queue = WORKERS_QUEUES[index];
        const payload = Buffer.from(JSON.stringify(partTask._id));

        await channel.assertQueue(queue, { durable: true });
        channel.sendToQueue(queue, payload);
        console.log(`📤 Отправлено в ${queue}:`, partTask._id);
        ////


        axios.post(`${WORKERS[index]}/internal/api/worker/hash/crack/task`, {
            idPartTask: partTask._id
        }).then(response => {
            partTask.status = 'SENT'
            partTask.save()
                  })
            .catch(error => {
                ///TODO нужно отправить на другово воркера наверно
                console.error(`Ошибка при отправки задачи воркеру ${index + 1}:`, error.response?.data || error.message);
            });
    }
    newTask.status = 'IN_PROGRESS'
    await newTask.save()
    res.json({ requestId });
}

export const patchTaskFromWorkers = async (req, res) => {
    const { idPartTask, status, taskId } = req.body;
    console.log(idPartTask, status, taskId);

    if (idPartTask === undefined || taskId === undefined) {
        return res.status(400).json({ error: "Invalid result data" });
    }
    let task
    let partTask
    try {
        task = await Task.findOne({idTask: taskId})
        partTask = await PartTask.find({idTask: taskId})
        //console.log(task)
        //console.log(partTask)
    } catch (error) {
        console.log("Ошибка получения task и partTask из бд = ", error)
    }

    let countReady = 0
    for (let curPartTask of partTask) {
        if (curPartTask.status === 'READY' && curPartTask.percentComplete === 100) {
            countReady += 1
            //console.log(curPartTask)

            if (curPartTask.found !== undefined && curPartTask.found.length > 0) {
                for (let foundWord of curPartTask.found) {
                    if (!task.found.includes(foundWord)) {
                        task.found.push(foundWord);
                    }
                }
            }
        }
    }

    if (countReady === partTask.length) {
        console.log("Зашел обновлять статус")
        task.status = "READY"
        task.percentComplete = 100
        task.save()
    }
    // чекнуть если все части готовы то и основную сделать статус реди и 100 %


    // if (task && partTask && partTask.percentComplete === 100 && partTask.status === "READY") {
    //     console.log("Зашел обновлять статус")
    //     task.status = "PART_ANSWER_IS_READY"
    //     task.save()
    // }

    res.status(200).json({ message: "Результат принят" });
}
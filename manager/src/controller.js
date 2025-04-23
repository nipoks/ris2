import {v4 as uuidv4} from "uuid";
import dotenv from "dotenv";
import Task from "./models/task.js";
import PartTask from "./models/partTask.js";
import {getRabbitChannel} from "./rabbit/connection.js";

dotenv.config();

const WORKERS = process.env.WORKERS ? process.env.WORKERS.split(',') : [];
let requests = {};
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const getTaskStatus = async (req, res) => {
    const {requestId} = req.query;
    if (!requestId) {
        return res.status(400).json({error: "Invalid requestId"});
    }

    const task = await Task.findOne({idTask: requestId})
    if (task.status === "READY" ) {
        return res.json({
            status: 'READY',
            data: {
                answer: task.found,
                progress: `100%`
            }
        });
    }

    const partsTask = await PartTask.find({idTask: requestId})
    let persent = 0
    for (let curPartTask of partsTask) { /// смотреть на процент
        persent += curPartTask.percentComplete
    }

    const progress = Math.floor(persent / partsTask.length);
    return res.json({
        status: 'IN_PROGRESS',
        data: {
            progress: `${progress}%`
        }
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
        partCount: WORKERS.length,
        partComplete: 0,
        alphabet: alphabet
    })
    await newTask.save()

    const channel = getRabbitChannel();
    const queue = "task_q";
    await channel.assertQueue(queue, { durable: true });

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
        const data = {
            idPartTask: partTask._id,
            alphabet: alphabet,
            partNumber: index + 1,
            partCount: WORKERS.length,
            hash: newTask.hash,
            maxLength: newTask.maxLength
        }
        const payload = Buffer.from(JSON.stringify({data}));
        channel.sendToQueue(queue, payload, { persistent: true });
        console.log(`Отправлено в ${queue}:`, partTask._id);
        partTask.status = 'SENT'
        await partTask.save()
    }
    newTask.status = 'IN_PROGRESS'
    await newTask.save()
    res.json({ requestId });
}

export const handlerAnswerFromWorker = async (data) => {
    let partTask
    let task
    try {
        partTask = await PartTask.findById(data.idPartTask)
        task = await Task.findOne({idTask: partTask.idTask})

    } catch (error) {
        console.log("Ошибка получения task и partTask из бд = ", error)
    }
    if (data.status === "READY") {
        partTask.status = 'READY'
        partTask.found = data.found
        await partTask.save()
        task.partComplete += 1

        if (partTask.found !== undefined && partTask.found.length > 0) {
            for (let foundWord of partTask.found) {
                if (!task.found.includes(foundWord)) {
                    task.found.push(foundWord);
                }
            }
        }
        console.log(task.found)

        if (task.partComplete === task.partCount) {
            task.status = 'READY'
            task.percentComplete = 100
        }

        await task.save()
    }
}

export const handlerStatusFromWorker = async (data) => {
    try {
        const partTask = await PartTask.findById(data.idPartTask)
        if (partTask.status === 'READY' && partTask.percentComplete === 100) {
            return
        }
        partTask.status = data.status;
        partTask.percentComplete = data.percentComplete;
        await partTask.save()
    } catch (error) {
        console.log(error)
    }
}
import { parentPort } from 'worker_threads';
import { createHash } from 'crypto';
import PartTask from "./models/partTask.js";
import mongoose from "mongoose";

function hashString(str) {
    return createHash('md5').update(str).digest('hex');
}

function getTotalWordsCount(alphabet, maxLength) {
    let total = 0;
    for (let length = 1; length <= maxLength; ++length) {
        total += Math.pow(alphabet.length, length);
    }
    return total;
}

function generateWordFromIndex(alphabet, maxLength, index) {
    let word = '';
    let alphabetSize = alphabet.length;

    let length = 1;
    let relativeIndex = index;

    while (relativeIndex >= Math.pow(alphabetSize, length)) {
        relativeIndex -= Math.pow(alphabetSize, length)
        length++;
    }

    for (let i = 0; i < length; i++) {
        let letterIndex = relativeIndex % alphabetSize;
        word = alphabet[letterIndex] + word;
        relativeIndex = Math.floor(relativeIndex / alphabetSize);
    }
    return word;
}

async function hardWork(idPartTask) {
    let partTask
    try {
        console.log("Пытаюсь получить по id = ", idPartTask);
        partTask = await PartTask.findById(idPartTask)
        console.log("строка 47 = ", partTask);
    } catch (error) {
        console.error("Ошибка при запросе: ", error);
    }
    const totalWords = getTotalWordsCount(partTask.alphabet, partTask.maxLength);


    const range = {
        start: Math.floor((partTask.partNumber - 1) * totalWords / partTask.partCount),
        end: Math.floor(partTask.partNumber * totalWords / partTask.partCount)
    };
    let found = [];

    for (let i = range.start; i < range.end; i++) {
        const word = generateWordFromIndex(partTask.alphabet, partTask.maxLength, i);
        if (hashString(word) === partTask.hash) {
            found.push(word);
        }
        partTask.percentComplete = Math.floor((i - range.start) / (range.end - range.start) * 100)
    }

    partTask.status = "READY";
    partTask.found = found;
    await partTask.save()

    console.log("73 строка, результат задачи = ", partTask);
    await mongoose.disconnect();
    try {
        const safeFound = JSON.parse(JSON.stringify(partTask.found));
        parentPort.postMessage({ found: safeFound, partNumber: partTask.partNumber, status: partTask.status });
    } catch (error) {
        console.error("Ошибка при отправке сообщения в основной поток: ", error);
    }}

parentPort.on('message', async (data) => {

    const {idPartTask} = data;
    await mongoose
        .connect(process.env.MONGO_URI, {dbName: process.env.DB_NAME})
        .then(async () => {
            console.log("MongoDB connected in worker thread")
        })
        .catch((err) => console.error("MongoDB connection error:", err));

    await hardWork(idPartTask);
});

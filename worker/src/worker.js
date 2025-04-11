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
    let totalWords
    try {
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log("Строка 51 ", partTask.alphabet, partTask.maxLength);
        totalWords = getTotalWordsCount(partTask.alphabet, partTask.maxLength);
        console.log("Строка 53 ", totalWords);
    } catch (error) {
        console.log("Ебатория легла тут 54", error);
    }

    let range
    try {
        range = {
            start: Math.floor((partTask.partNumber - 1) * totalWords / partTask.partCount),
            end: Math.floor(partTask.partNumber * totalWords / partTask.partCount)
        };
        console.log("57 строка = ", range);
    } catch (error) {
        console.log("Ебатория легла тут 66", error);
    }
    let found = [];


    try {
        for (let i = range.start; i < range.end; i++) {
            const word = generateWordFromIndex(partTask.alphabet, partTask.maxLength, i);
            if (hashString(word) === partTask.hash) {
                found.push(word);
            }
            partTask.percentComplete = Math.floor((i - range.start) / (range.end - range.start) * 100)
            //myMap.set(requestId, Math.floor((i - range.start) / (range.end - range.start) * 100));
        }
    } catch (error) {
        console.log("Ебатория легла тут 80", error);
    }

    try {
        console.log("69 строка, найденные ответы = ", found);
        partTask.status = "READY";
        partTask.found = found;
        partTask.save()
    } catch (error) {
        console.log("Ебатория легла тут 89", error);
    }

    console.log("73 строка, результат задачи = ", partTask);

    parentPort.postMessage({ partTask });
}

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

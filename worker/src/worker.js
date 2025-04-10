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
        if (!mongoose.Types.ObjectId.isValid(idPartTask)) {
            console.error("Некорректный ID");
            return;
        }
        partTask = await PartTask.findById(idPartTask).maxTimeMS(60000) // падает с тайм аутом
        console.log(partTask);
    } catch (error) {
        console.error("Ошибка при запросе: ", error);
    }
/*
2025-04-10 20:36:06 Пытаюсь получить по id =  67f7c946bba4bc2e7d5392d3
2025-04-10 20:36:16 Ошибка при запросе:  MongooseError: Operation `parttasks.findOne()` buffering timed out after 10000ms
2025-04-10 20:36:16     at Timeout.<anonymous> (/app/node_modules/mongoose/lib/drivers/node-mongodb-native/collection.js:187:23)
2025-04-10 20:36:16     at listOnTimeout (node:internal/timers:569:17)
2025-04-10 20:36:16     at process.processTimers (node:internal/timers:512:7)
2025-04-10 20:36:16 Ошибка в worker для задачи 67f7c946bba4bc2e7d5392d3: Cannot read properties of undefined (reading 'alphabet')
2025-04-10 20:36:16 Worker завершился с ошибкой для задачи 67f7c946bba4bc2e7d5392d3, код: 1
 */
    const totalWords = getTotalWordsCount(partTask.alphabet, partTask.maxLength);
    const range = {
        start: Math.floor((partTask.partNumber - 1) * totalWords / partTask.partCount),
        end: Math.floor(partTask.partNumber * totalWords / partTask.partCount)
    };

    let found = [];
    //myMap.set(requestId, 0);

    for (let i = range.start; i < range.end; i++) {
        const word = generateWordFromIndex(partTask.alphabet, partTask.maxLength, i);
        if (hashString(word) === hash) {
            found.push(word);
        }
        partTask.percentComplete = Math.floor((i - range.start) / (range.end - range.start) * 100)
        //myMap.set(requestId, Math.floor((i - range.start) / (range.end - range.start) * 100));
    }
    partTask.status = "READY";
    partTask.found = found;
    partTask.save()
    parentPort.postMessage({ status: 'READY' });
}

parentPort.on('message', (data) => {

    const { idPartTask } = data;

    hardWork(idPartTask);
});

import PartTask from '../models/partTask.js';
import Task from '../models/task.js';
import { getRabbitChannel } from './connection.js';

export const resendUnsentPartTasks = async () => {
    const queue = process.env.TASK_QUEUE;
    const channel = getRabbitChannel();

    try {
        await channel.assertQueue(queue, { durable: true });

        const unsentParts = await PartTask.find({ status: 'CREATE' });

        if (unsentParts.length === 0) {
            console.log("📭 Нет задач со статусом CREATE для повторной отправки");
            return;
        }

        console.log(`🔁 Повторная отправка ${unsentParts.length} задач в очередь...`);
        const tasksMap = new Map();

        for (const partTask of unsentParts) {
            const idTask = partTask.idTask.toString();

            // Отправка в очередь
            try {
                const data = {
                    idPartTask: partTask._id,
                    alphabet: partTask.alphabet,
                    partNumber: partTask.partNumber,
                    partCount: partTask.partCount,
                    hash: partTask.hash,
                    maxLength: partTask.maxLength,
                };
                const payload = Buffer.from(JSON.stringify({ data }));

                channel.sendToQueue(queue, payload, { persistent: true });
                console.log(`✅ Повторно отправлено:`, partTask._id);

                partTask.status = 'SENT';
                await partTask.save();

                if (!tasksMap.has(idTask)) tasksMap.set(idTask, []);
                tasksMap.get(idTask).push(partTask);

            } catch (sendErr) {
                console.warn(`⚠️ Не удалось отправить ${partTask._id}: ${sendErr.message}`);
            }
        }

        // Проверяем по каждой Task, все ли её PartTask отправлены
        for (const [idTask, sentParts] of tasksMap.entries()) {
            const totalParts = await PartTask.countDocuments({ idTask });
            const sentCount = await PartTask.countDocuments({ idTask, status: 'SENT' });

            if (totalParts === sentCount) {
                await Task.updateOne({ idTask }, { status: 'SENT' });
                console.log(`🔄 Статус Task ${idTask} обновлён на SENT`);
            } else {
                console.log(`⏳ Task ${idTask} пока не полностью отправлена (${sentCount}/${totalParts})`);
            }
        }
    } catch (err) {
        console.error("🚨 Ошибка при повторной отправке задач:", err.message);
        setTimeout(resendUnsentPartTasks, 5000);
    }
};

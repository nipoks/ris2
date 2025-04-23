import PartTask from '../models/PartTask.js';
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

        for (const partTask of unsentParts) {
            const data = {
                idPartTask: partTask._id,
                alphabet: partTask.alphabet,
                partNumber: partTask.partNumber,
                partCount: partTask.partCount,
                hash: partTask.hash,
                maxLength: partTask.maxLength,
            };
            const payload = Buffer.from(JSON.stringify({ data }));

            try {
                channel.sendToQueue(queue, payload, { persistent: true });
                console.log(`✅ Повторно отправлено в очередь ${queue}:`, partTask._id);
                partTask.status = 'SENT';
                await partTask.save();
            } catch (sendErr) {
                console.warn(`⚠️ Не удалось отправить ${partTask._id} повторно: ${sendErr.message}`);
            }
        }
    } catch (err) {
        console.error("🚨 Ошибка при повторной отправке задач:", err.message);
    }
};

import mongoose, {Schema} from "mongoose"

const PartTaskSchema = new Schema({
    idTask: { type: String, ref: "Task" },
    idWorker: { type: String, required: true },
    found: { type: [String], required: true },
    status: { type: String, required: true },
    percentComplete: { type: Number, required: true },
    partNumber: { type: Number, required: true },
    partCount: { type: Number, required: true },
    alphabet: { type: String, required: true },
    hash: { type: String, required: true },
    maxLength: { type: Number, required: true },
});

const PartTask = mongoose.model("PartTask", PartTaskSchema);

export default PartTask;
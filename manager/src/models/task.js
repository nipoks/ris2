import mongoose, {Schema} from "mongoose"

const TaskSchema = new Schema({
    idTask: { type: String, required: true },
    found: { type: [String], required: true },
    status: { type: String, required: true },
    hash: { type: String, required: true },
    maxLength: { type: Number, required: true },
    percentComplete: { type: Number, required: true },
    alphabet: { type: String, required: true },
});

const Task = mongoose.model("Task", TaskSchema);

export default Task;
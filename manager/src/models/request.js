import mongoose, { Schema, Document, ObjectId } from "mongoose"

const RequestSchema = new Schema({
    _id: { type: Types.ObjectId, auto: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    curExpression: { type: String, default: "0" },
    memoryNumber: { type: Number, default: undefined },
});

const Request = mongoose.model("Request", RequestSchema);

export default Request;
import { Schema, model } from "mongoose";

const OpSchema = new Schema({
  boardId: { type: String, index: true },
  seq: { type: Number, index: true },
  opId: { type: String, unique: false },
  type: { type: String },
  userId: { type: String },
  payload: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

OpSchema.index({ boardId: 1, seq: 1 }, { unique: true });

export default model("Op", OpSchema);

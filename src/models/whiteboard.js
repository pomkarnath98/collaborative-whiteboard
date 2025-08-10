import { Schema, model } from "mongoose";

const WhiteboardSchema = new Schema(
  {
    sessionId: { type: String, unique: true, index: true },
    title: { type: String, default: "Untitled" },
    owner: { type: String, default: null },
    permissions: {
      default: { type: String, enum: ["edit", "view"], default: "edit" },
    },
    createdAt: { type: Date, default: Date.now },
    lastSeq: { type: Number, default: 0 },
  },
  { minimize: false }
);

export default model("Whiteboard", WhiteboardSchema);

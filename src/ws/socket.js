import { Server } from "socket.io";
import Whiteboard from "../models/whiteboard.js";
import Op from "../models/op.js";
import { nanoid } from "nanoid";
import { getRedis } from "../redis/redis.js";

const PRESENCE_SET_PREFIX = "board:presence:";
const PRESENCE_TTL = 30; // seconds TTL for presence heartbeat

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.on("connection", async (socket) => {
    const { boardId, userId, lastSeq } = socket.handshake.query;
    if (!boardId) {
      socket.disconnect(true);
      return;
    }
    const uid = userId || nanoid(8);
    socket.data.userId = uid;
    socket.join(boardId);

    const redis = getRedis();

    try {
      await redis.sAdd(PRESENCE_SET_PREFIX + boardId, uid);
      await redis.expire(PRESENCE_SET_PREFIX + boardId, PRESENCE_TTL);
      const members = await redis.sMembers(PRESENCE_SET_PREFIX + boardId);
      socket.emit("presence:list", members);
      socket.to(boardId).emit("presence:join", uid);
    } catch (e) {
      console.warn("Presence error", e);
    }

    const sinceSeq = parseInt(lastSeq || "0", 10);
    try {
      const missingOps = await Op.find({ boardId, seq: { $gt: sinceSeq } })
        .sort({ seq: 1 })
        .lean()
        .limit(5000);
      if (missingOps && missingOps.length > 0) {
        socket.emit("sync:ops", missingOps);
      } else {
        const meta = await Whiteboard.findOne({ sessionId: boardId }).lean();
        const serverLast = meta ? meta.lastSeq : 0;
        socket.emit("sync:status", { lastSeq: serverLast });
      }
    } catch (e) {
      console.error("Sync error", e);
      socket.emit("sync:error", { message: "Failed to sync" });
    }

    socket.on("op:send", async (clientOp) => {
      try {
        if (!clientOp || typeof clientOp !== "object") {
          socket.emit("op:error", { message: "Invalid op" });
          return;
        }
        const allowedTypes = ["draw", "clear", "undo", "redo", "presence"];
        const type = clientOp.type || "draw";
        if (!allowedTypes.includes(type)) {
          socket.emit("op:error", { message: "Unsupported op type" });
          return;
        }

        if (
          (type === "undo" || type === "redo") &&
          (!clientOp.payload || !clientOp.payload.targetOpId)
        ) {
          socket.emit("op:error", { message: "undo/redo requires targetOpId" });
          return;
        }

        const updatedBoard = await Whiteboard.findOneAndUpdate(
          { sessionId: boardId },
          { $inc: { lastSeq: 1 } },
          { new: true, upsert: true }
        ).lean();

        const seq = updatedBoard.lastSeq;
        const opDoc = {
          boardId,
          seq,
          opId: clientOp.opId || nanoid(12),
          type,
          payload: clientOp.payload || {},
          userId: uid,
          timestamp: new Date(),
        };

        await Op.create(opDoc);

        io.in(boardId).emit("op:recv", opDoc);
      } catch (err) {
        console.error("Failed to persist op", err);
        socket.emit("op:error", { message: "Failed to persist operation" });
      }
    });

    socket.on("cursor:move", (cursor) => {
      socket.to(boardId).emit("cursor:update", { userId: uid, cursor });
    });

    socket.on("presence:heartbeat", async () => {
      try {
        await getRedis().expire(PRESENCE_SET_PREFIX + boardId, PRESENCE_TTL);
      } catch (e) {
        console.error("error on heartbeat check", e);
      }
    });

    socket.on("disconnect", async () => {
      try {
        await getRedis().sRem(PRESENCE_SET_PREFIX + boardId, uid);
        socket.to(boardId).emit("presence:leave", uid);
      } catch (e) {
        console.error("Socket connection error", e);
        socket.disconnect(true);
      }
    });
  });

  return io;
}

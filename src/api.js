import { Router } from "express";
const router = Router();
import { nanoid } from "nanoid";
import Whiteboard from "./models/whiteboard.js";

// Create a new whiteboard
router.post("/whiteboard/create", async (req, res) => {
  try {
    const sessionId = nanoid(10);
    const wb = new Whiteboard({
      sessionId,
      title: req.body.title || "Untitled",
      owner: req.body.owner || null,
    });
    await wb.save();
    return res.status(201).json({ sessionId, url: `/whiteboard/${sessionId}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create whiteboard" });
  }
});

// Get whiteboard metadata
router.get("/whiteboard/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const wb = await Whiteboard.findOne({ sessionId: id }).lean();
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    return res.json({
      sessionId: wb.sessionId,
      title: wb.title,
      owner: wb.owner,
      lastSeq: wb.lastSeq,
      createdAt: wb.createdAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch whiteboard" });
  }
});

export default router;

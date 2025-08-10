const params = new URLSearchParams(location.search);
const defaultBoardId = params.get("board") || "";

let socket = null;
let boardId = defaultBoardId;
let userId =
  localStorage.getItem("wb:userId") ||
  "u_" + Math.random().toString(36).slice(2, 9);
localStorage.setItem("wb:userId", userId);
let ops = [];

const canvas = document.getElementById("boardCanvas");
const wrap = document.getElementById("canvasWrap");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  redrawFromOps();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let isDrawing = false;
let lastPos = null;
let strokeColor = "#000";
let strokeWidth = 2;

let opQueue = JSON.parse(localStorage.getItem("wb:queue:" + userId) || "[]");

let localOpIds = [];
let undoneOpIds = [];

function saveQueue() {
  localStorage.setItem("wb:queue:" + userId, JSON.stringify(opQueue));
}

function pushOpLocal(op) {
  ops.push(op);
  if (op.type === "draw") localOpIds.push(op.opId);
  applyOpToCanvas(op);
}

function drawLineSegment(a, b, color = "#000", width = 2) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function applyOpToCanvas(op) {
  if (!op) return;
  if (op.type === "draw") {
    const pts = op.payload.points;
    if (pts && pts.length >= 2) {
      for (let i = 1; i < pts.length; i++) {
        drawLineSegment(
          { x: pts[i - 1][0], y: pts[i - 1][1] },
          { x: pts[i][0], y: pts[i][1] },
          op.payload.color,
          op.payload.width
        );
      }
    }
  } else if (op.type === "clear") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else if (op.type === "undo") {
    const target = op.payload.targetOpId;
    if (target) {
      for (const o of ops) if (o.opId === target) o.tomb = true;
      redrawFromOps();
    }
  } else if (op.type === "redo") {
    const target = op.payload.targetOpId;
    if (target) {
      for (const o of ops) if (o.opId === target) o.tomb = false;
      redrawFromOps();
    }
  }
}

function redrawFromOps() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const op of ops) {
    if (op.tomb) continue;
    applyOpToCanvas(op);
  }
}

document.getElementById("createBtn").addEventListener("click", async () => {
  const res = await fetch("/whiteboard/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const j = await res.json();
  document.getElementById("boardIdInput").value = j.sessionId;
  alert("Created board: " + j.sessionId);
});

document.getElementById("joinBtn").addEventListener("click", () => {
  const id = document.getElementById("boardIdInput").value.trim();
  if (!id) return alert("Enter board id or create one");
  joinBoard(id);
});

document.getElementById("undoBtn").addEventListener("click", () => {
  if (!localOpIds.length) return;
  const target = localOpIds.pop();
  undoneOpIds.push(target);
  const op = {
    opId: "op_" + Math.random().toString(36).slice(2, 9),
    type: "undo",
    payload: { targetOpId: target },
  };
  emitOrQueue(op);
  ops.forEach((o) => {
    if (o.opId === target) o.tomb = true;
  });
  redrawFromOps();
});

document.getElementById("redoBtn").addEventListener("click", () => {
  if (!undoneOpIds.length) return;
  const target = undoneOpIds.pop();
  localOpIds.push(target);
  const op = {
    opId: "op_" + Math.random().toString(36).slice(2, 9),
    type: "redo",
    payload: { targetOpId: target },
  };
  emitOrQueue(op);
  ops.forEach((o) => {
    if (o.opId === target) o.tomb = false;
  });
  redrawFromOps();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  const op = {
    opId: "op_" + Math.random().toString(36).slice(2, 9),
    type: "clear",
    payload: {},
  };
  emitOrQueue(op);
  ops = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function joinBoard(id) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  boardId = id;
  const lastSeq = parseInt(
    localStorage.getItem("wb:lastSeq:" + boardId) || "0",
    10
  );

  socket = io("/", { query: { boardId, userId, lastSeq } });
  socket.on("connect", () => {
    console.log("connected", socket.id);
    flushQueue();
    setInterval(() => {
      if (socket && socket.connected) socket.emit("presence:heartbeat");
    }, 10000);
  });

  socket.on("sync:ops", (missing) => {
    for (const op of missing) {
      op.tomb = false;
      ops.push(op);
      applyOpToCanvas(op);
      localStorage.setItem("wb:lastSeq:" + boardId, op.seq);
    }
  });

  socket.on("op:recv", (op) => {
    op.tomb = op.tomb || false;
    ops.push(op);
    applyOpToCanvas(op);
    if (op.seq) localStorage.setItem("wb:lastSeq:" + boardId, op.seq);
  });

  socket.on("presence:list", (list) => {
    document.getElementById("userList").innerText = (list || []).length;
  });

  socket.on("cursor:update", (data) => {
    showRemoteCursor(data.userId, data.cursor);
  });

  socket.on("disconnect", (reason) => {
    console.log("disconnected", reason);
  });

  socket.on("op:error", (e) => {
    console.warn("op error", e);
  });

  fetch("/whiteboard/" + boardId)
    .then((r) => r.json())
    .then((meta) => {
      console.log("joined board", meta);
    })
    .catch(() => {});
}

function emitOrQueue(op) {
  const opEnvelope = {
    opId: op.opId,
    type: op.type,
    payload: op.payload,
    userId: userId,
    timestamp: Date.now(),
  };
  if (socket && socket.connected) {
    socket.emit("op:send", opEnvelope);
  } else {
    opQueue.push(opEnvelope);
    saveQueue();
  }
  pushOpLocal(opEnvelope);
}

function flushQueue() {
  if (!socket || !socket.connected) return;
  if (!opQueue.length) return;
  while (opQueue.length) {
    const op = opQueue.shift();
    socket.emit("op:send", op);
  }
  saveQueue();
}

canvas.addEventListener("pointerdown", (e) => {
  isDrawing = true;
  lastPos = getCanvasCoords(e);
});

canvas.addEventListener("pointermove", (e) => {
  const pos = getCanvasCoords(e);
  if (socket && socket.connected) socket.emit("cursor:move", pos);

  if (!isDrawing) return;
  const points = [
    [lastPos.x, lastPos.y],
    [pos.x, pos.y],
  ];
  const op = {
    opId: "op_" + Math.random().toString(36).slice(2, 9),
    type: "draw",
    payload: { points, color: strokeColor, width: strokeWidth },
  };
  emitOrQueue(op);
  lastPos = pos;
});

canvas.addEventListener("pointerup", () => {
  isDrawing = false;
  lastPos = null;
});

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

const remoteCursorMap = {};
function showRemoteCursor(userId, cursor) {
  if (!cursor) return;
  let el = remoteCursorMap[userId];
  if (!el) {
    el = document.createElement("div");
    el.className = "cursor";
    el.innerText = userId;
    wrap.appendChild(el);
    remoteCursorMap[userId] = el;
  }
  el.style.left = cursor.x + "px";
  el.style.top = cursor.y + "px";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.display = "none";
  }, 3000);
  el.style.display = "block";
}

if (boardId) {
  document.getElementById("boardIdInput").value = boardId;
  joinBoard(boardId);
}

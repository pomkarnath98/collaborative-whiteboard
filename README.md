# Collaborative Whiteboard (Node.js + Socket.IO + Redis + MongoDB Atlas)

## Overview
This project implements a production-oriented real-time collaborative whiteboard with:
- WebSocket real-time delta updates
- MongoDB Atlas persistence (ops stored in `ops` collection)
- Redis Cloud for presence and Socket.IO Redis adapter (pub/sub)
- Undo/Redo via ops, cursor & presence tracking, reconnect incremental sync
- Offline queueing on the client for reconnect sync

## Tech Stacks
- Node.js 18+
- MongoDB Atlas connection string
- Redis Cloud connection string
- nodemon

## Setup
1. Clone the repo.
2. `cp .env` and fill `MONGO_URI` and `REDIS_URL`.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000/index.html`. Use "Create New Board" to create a board, copy the boardId, and join in multiple browser windows to test collaboration.

## Environment variables
- `MONGO_URI` - MongoDB Atlas connection string
- `REDIS_URL` - Redis Cloud connection URI
- `NODE_ENV` - Environment (defaults to 'development')
- `PORT` - server port (defaults to 3000)

## How it works (client/server)
- Client connects to Socket.IO with `boardId` & `userId`. Optionally passes `lastSeq`.
- Server sends missing ops (`seq > lastSeq`) as `sync:ops`.
- Client sends ops via `op:send`. Server assigns a monotonically increasing `seq` per board by atomically incrementing `lastSeq` in the `whiteboards` collection, persists op in `ops` collection, and broadcasts `op:recv`.
- Undo/redo implemented as ops with `type: 'undo'/'redo'` referencing target op id.
- Presence tracked in Redis set `board:presence:<boardId>` and broadcast as `presence:list`.

![Image](https://github.com/user-attachments/assets/3b620489-e97e-4ac2-ae3a-a155237c872e)

## Scaling notes
- The server uses Socket.IO Redis adapter (pub/sub) to scale horizontally by adding Node instances.
- MongoDB Atlas provides HA and scalability for the op store

## Future Scope
### Scaling
- For long-lived sessions, periodic snapshot & truncation can be used to avoid an extremely large `ops` collection scan.
- For conflict resolution in structured shared objects, CRDT libraries can be integrated.
### Monitoring
- APM cann be integrated by exporting metrics from Socket.IO / Redis latencies; MongoDB to write latencies.
### Security & production hardening
- Authentication (JWT) & permission checks (who can edit/view) can be added.
- Rate limitations can be done for cursor updates and small ops to avoid spam.
- Validate/op-size checks can be added on server to avoid huge payloads.

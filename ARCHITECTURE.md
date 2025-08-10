# Architecture - Collaborative Whiteboard

## Summary
- Node.js + Express + Socket.IO for HTTP & real-time
- MongoDB Atlas stores operations in `ops` collection, each with boardId + seq
- Redis Cloud used for Socket.IO adapter (pub/sub) and presence sets
- Clients subscribe to a room by boardId; server persists ops + broadcasts only deltas
- Incremental sync via per-board `lastSeq` to fetch missing ops after reconnect

## Data Model
- whiteboards: { sessionId, title, owner, permissions, lastSeq, createdAt }
- ops: { boardId, seq, opId, type, payload, userId, timestamp }

## Scalability
- Horizontal scaling: multiple Node instances + Socket.IO Redis adapter
- DB: MongoDB Atlas (replica set) for HA; if write throughput grows, shard by boardId
- For extremely high concurrency per board: consider partitioning canvas into tiles/shards and routing clients to specialized instances

## Conflict resolution
- Additive drawing ops are commutative, using seq ensures deterministic order.
- For structured objects, plug in CRDT to ensure conflict-free merging.

## Failure modes / Recovery
- Node crash: Socket.IO clients auto-reconnect; missing ops pulled via `lastSeq` from server
- Redis outage: local node still works for its clients, but cross-node pub/sub disabled - recommend alerting/HA for Redis
- Mongo outage: client ops will queue locally on client until DB is available; consider a write-back queue server-side if needed

## Future work
- Add per-board snapshots to bound op log size
- Add authentication and permission layers
- Add operational metrics with Prometheus/Grafana

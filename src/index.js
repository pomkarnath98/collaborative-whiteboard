import { createServer } from "http";
import express, { json, static as stc } from "express";
import helmet from "helmet";
import cors from "cors";
import { connectMongo } from "./mongoose/db.js";
import { connectRedis } from "./redis/redis.js";
import apiRoutes from "./api.js";
import { initSocket } from "./ws/socket.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { port } from "./config.js";
import { createLogger, transports as _transports } from "winston";

const logger = createLogger({
  transports: [new _transports.Console()],
});

(async function bootstrap() {
  await connectMongo();
  const redisClient = await connectRedis();

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(json());
  app.use(stc("public"));

  app.use(apiRoutes);

  const server = createServer(app);

  const io = initSocket(server);
  const pubClient = redisClient;
  const subClient = pubClient.duplicate();
  await subClient.connect();
  io.adapter(createAdapter(pubClient, subClient));

  server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
    logger.info(`Open http://localhost:${port}/index.html to try the demo`);
  });

  process.on("SIGINT", async () => {
    logger.info("Shutting down...");
    await subClient.disconnect().catch(() => {});
    await pubClient.disconnect().catch(() => {});
    process.exit(0);
  });
})();

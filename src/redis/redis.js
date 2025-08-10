import { createClient } from "redis";
import { redisUrl } from "../config.js";
import { createLogger, transports as _transports } from "winston";

const logger = createLogger({
  transports: [new _transports.Console()],
});

let redisClient;

async function connectRedis() {
  if (!redisUrl) {
    logger.error("REDIS_URL is not set. Set it in environment variables.");
    process.exit(1);
  }
  redisClient = createClient({ url: redisUrl });
  redisClient.on("error", (err) => {
    logger.error("Redis error:", err);
  });
  await redisClient.connect();
  logger.info("Connected to Redis");
  return redisClient;
}

function getRedis() {
  if (!redisClient)
    throw new Error("Redis client not initialized. Call connectRedis() first.");
  return redisClient;
}

export { connectRedis, getRedis };

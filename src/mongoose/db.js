import { set, connect } from "mongoose";
import { mongoUri } from "../config.js";
import { createLogger, transports as _transports } from "winston";

const logger = createLogger({
  transports: [new _transports.Console()],
});

async function connectMongo() {
  if (!mongoUri) {
    logger.error("MONGO_URI is not set. Set it in environment variables.");
    process.exit(1);
  }
  set("strictQuery", false);
  await connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  logger.info("Connected to MongoDB");
}

export { connectMongo };

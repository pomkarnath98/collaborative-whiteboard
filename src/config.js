import dotenv from "dotenv";
dotenv.config();

export const port = process.env.PORT || 3000;
export const mongoUri = process.env.MONGO_URI;
export const redisUrl = process.env.REDIS_URL;
export const env = process.env.NODE_ENV || "development";

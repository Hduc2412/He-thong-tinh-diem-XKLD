import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/xkld_points",
  jwtSecret: process.env.JWT_SECRET || "dev_only_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173",
};

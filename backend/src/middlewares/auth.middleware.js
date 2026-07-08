import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Missing access token");
  }

  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.sub).select("-passwordHash");

  if (!user || user.status !== "Hoat dong") {
    throw new ApiError(401, "Invalid user session");
  }

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Permission denied"));
    }
    next();
  };
}

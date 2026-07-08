import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).default("123456"),
  role: z.enum(["Admin", "CTV"]).default("CTV"),
  ctvCode: z.string().optional(),
  parent: z.string().optional().nullable(),
  level: z.string().default("CTV cap 1"),
});

export const listUsers = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const filter = role ? { role } : {};
  const users = await User.find(filter).select("-passwordHash").populate("parent", "name ctvCode");
  res.json({ data: users });
});

export const createUser = asyncHandler(async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await User.create({ ...input, passwordHash });
  const safeUser = await User.findById(user._id).select("-passwordHash").populate("parent", "name ctvCode");
  res.status(201).json({ data: safeUser });
});

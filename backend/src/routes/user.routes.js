import { Router } from "express";
import { createUser, listUsers } from "../controllers/user.controller.js";
import { authenticate, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("Admin"), listUsers);
router.post("/", requireRole("Admin"), createUser);

export default router;

import { Router } from "express";
import { createPointCode, listPointCodes, redeemPointCode } from "../controllers/pointCode.controller.js";
import { authenticate, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("Admin"), listPointCodes);
router.post("/", requireRole("Admin"), createPointCode);
router.post("/redeem", requireRole("CTV"), redeemPointCode);

export default router;

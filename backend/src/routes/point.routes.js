import { Router } from "express";
import { listPoints } from "../controllers/point.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", listPoints);

export default router;

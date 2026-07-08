import { Router } from "express";
import authRoutes from "./auth.routes.js";
import customerRoutes from "./customer.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import pointCodeRoutes from "./pointCode.routes.js";
import pointRoutes from "./point.routes.js";
import userRoutes from "./user.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/customers", customerRoutes);
router.use("/point-codes", pointCodeRoutes);
router.use("/points", pointRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;

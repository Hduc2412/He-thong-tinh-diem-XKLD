import { Router } from "express";
import { createCustomer, listCustomers } from "../controllers/customer.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", listCustomers);
router.post("/", createCustomer);

export default router;

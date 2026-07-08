import { z } from "zod";
import { Customer } from "../models/Customer.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createCustomerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  market: z.string().min(2),
  owner: z.string().optional(),
  status: z.enum(["REGISTERED", "INTERVIEW_DONE", "PASSED", "DEPARTED"]).default("REGISTERED"),
  note: z.string().optional(),
});

export const listCustomers = asyncHandler(async (req, res) => {
  const filter = req.user.role === "CTV" ? { owner: req.user._id } : {};
  const customers = await Customer.find(filter).populate("owner", "name ctvCode");
  res.json({ data: customers });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const input = createCustomerSchema.parse(req.body);
  const owner = req.user.role === "CTV" ? req.user._id : input.owner || req.user._id;
  const customer = await Customer.create({ ...input, owner });
  const populated = await Customer.findById(customer._id).populate("owner", "name ctvCode");
  res.status(201).json({ data: populated });
});

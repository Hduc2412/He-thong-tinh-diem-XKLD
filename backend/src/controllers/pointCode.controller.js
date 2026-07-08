import { z } from "zod";
import { Activity } from "../models/Activity.js";
import { Customer } from "../models/Customer.js";
import { PointCode } from "../models/PointCode.js";
import { PointTransaction } from "../models/PointTransaction.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { currentMonth } from "../utils/date.js";

const createPointCodeSchema = z.object({
  customer: z.string(),
  orderName: z.string().min(2),
  totalPoints: z.number().int().positive().default(10),
  directPoints: z.number().int().nonnegative().default(9),
  uplinePoints: z.number().int().nonnegative().default(1),
  code: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const redeemSchema = z.object({
  code: z.string().min(3),
});

function makeCode() {
  return `CODE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export const listPointCodes = asyncHandler(async (_req, res) => {
  const codes = await PointCode.find()
    .populate("customer", "name market")
    .populate("createdBy", "name")
    .populate("usedBy", "name ctvCode")
    .sort({ createdAt: -1 });
  res.json({ data: codes });
});

export const createPointCode = asyncHandler(async (req, res) => {
  const input = createPointCodeSchema.parse(req.body);
  const customer = await Customer.findById(input.customer);

  if (!customer) {
    throw new ApiError(404, "Khong tim thay khach hang");
  }

  const code = await PointCode.create({
    code: input.code || makeCode(),
    customer: input.customer,
    orderName: input.orderName,
    totalPoints: input.totalPoints,
    directPoints: input.directPoints,
    uplinePoints: input.uplinePoints,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdBy: req.user._id,
  });

  await Activity.create({
    actor: req.user._id,
    action: "CREATE_POINT_CODE",
    targetType: "PointCode",
    targetId: code._id,
    metadata: { code: code.code, customer: customer.name },
  });

  res.status(201).json({ data: code });
});

export const redeemPointCode = asyncHandler(async (req, res) => {
  const input = redeemSchema.parse(req.body);
  const code = await PointCode.findOne({ code: input.code.toUpperCase() }).populate("customer");

  if (!code || code.status !== "ACTIVE") {
    throw new ApiError(400, "Ma khong ton tai hoac da duoc su dung");
  }

  if (code.expiresAt && code.expiresAt < new Date()) {
    throw new ApiError(400, "Ma da het han");
  }

  if (code.customer.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Ma nay khong thuoc khach hang cua CTV hien tai");
  }

  const ctv = await User.findById(req.user._id).populate("parent", "name role");
  const month = currentMonth();
  const transactions = [
    {
      beneficiary: ctv._id,
      customer: code.customer._id,
      pointCode: code._id,
      points: code.directPoints,
      type: "DIRECT",
      note: `Cong diem truc tiep tu ma ${code.code}`,
      month,
      createdBy: req.user._id,
    },
  ];

  if (ctv.parent && code.uplinePoints > 0) {
    transactions.push({
      beneficiary: ctv.parent._id,
      customer: code.customer._id,
      pointCode: code._id,
      points: code.uplinePoints,
      type: "UPLINE",
      note: `Cong diem cap tren tu ma ${code.code}`,
      month,
      createdBy: req.user._id,
    });
  }

  const createdTransactions = await PointTransaction.insertMany(transactions);
  code.status = "USED";
  code.usedBy = req.user._id;
  code.usedAt = new Date();
  await code.save();

  await Activity.create({
    actor: req.user._id,
    action: "REDEEM_POINT_CODE",
    targetType: "PointCode",
    targetId: code._id,
    metadata: { code: code.code, transactions: createdTransactions.length },
  });

  res.json({ data: { code, transactions: createdTransactions } });
});

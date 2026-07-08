import { PointTransaction } from "../models/PointTransaction.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listPoints = asyncHandler(async (req, res) => {
  const filter = req.user.role === "CTV" ? { beneficiary: req.user._id } : {};
  const data = await PointTransaction.find(filter)
    .populate("beneficiary", "name ctvCode")
    .populate("customer", "name market")
    .populate("pointCode", "code orderName")
    .sort({ createdAt: -1 });

  res.json({ data });
});

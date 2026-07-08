import { Customer } from "../models/Customer.js";
import { PointTransaction } from "../models/PointTransaction.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { currentMonth } from "../utils/date.js";

export const dashboard = asyncHandler(async (req, res) => {
  const month = req.query.month || currentMonth();
  const userFilter = req.user.role === "CTV" ? { _id: req.user._id } : { role: "CTV" };
  const customerFilter = req.user.role === "CTV" ? { owner: req.user._id } : {};
  const pointFilter = req.user.role === "CTV" ? { beneficiary: req.user._id, month } : { month };

  const [ctvCount, customerCount, pointAgg] = await Promise.all([
    User.countDocuments(userFilter),
    Customer.countDocuments(customerFilter),
    PointTransaction.aggregate([
      { $match: pointFilter },
      { $group: { _id: null, totalPoints: { $sum: "$points" } } },
    ]),
  ]);

  const totalPoints = pointAgg[0]?.totalPoints || 0;

  res.json({
    data: {
      month,
      ctvCount,
      customerCount,
      totalPoints,
      estimatedSalary: totalPoints * 10000,
    },
  });
});

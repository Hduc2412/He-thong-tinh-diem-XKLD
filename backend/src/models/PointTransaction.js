import mongoose from "mongoose";

const pointTransactionSchema = new mongoose.Schema(
  {
    beneficiary: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    pointCode: { type: mongoose.Schema.Types.ObjectId, ref: "PointCode", required: true },
    points: { type: Number, required: true },
    type: { type: String, enum: ["DIRECT", "UPLINE"], required: true },
    note: { type: String, default: "" },
    month: { type: String, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const PointTransaction = mongoose.model("PointTransaction", pointTransactionSchema);

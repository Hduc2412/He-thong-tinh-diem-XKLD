import mongoose from "mongoose";

const pointCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    orderName: { type: String, required: true, trim: true },
    totalPoints: { type: Number, required: true, min: 1 },
    directPoints: { type: Number, required: true, min: 0 },
    uplinePoints: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["ACTIVE", "USED", "CANCELLED"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PointCode = mongoose.model("PointCode", pointCodeSchema);

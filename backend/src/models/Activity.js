import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: { type: String, default: "OK" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

export const Activity = mongoose.model("Activity", activitySchema);

import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    market: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["REGISTERED", "INTERVIEW_DONE", "PASSED", "DEPARTED"],
      default: "REGISTERED",
      index: true,
    },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Customer = mongoose.model("Customer", customerSchema);

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Admin", "CTV"], default: "CTV", index: true },
    ctvCode: { type: String, unique: true, sparse: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    level: { type: String, default: "CTV cap 1" },
    status: { type: String, enum: ["Hoat dong", "Tam dung"], default: "Hoat dong" },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

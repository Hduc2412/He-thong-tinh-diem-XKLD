import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { Activity } from "../models/Activity.js";
import { Customer } from "../models/Customer.js";
import { PointCode } from "../models/PointCode.js";
import { PointTransaction } from "../models/PointTransaction.js";
import { User } from "../models/User.js";

async function seed() {
  await connectDb();

  await Promise.all([
    Activity.deleteMany({}),
    PointTransaction.deleteMany({}),
    PointCode.deleteMany({}),
    Customer.deleteMany({}),
    User.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("123456", 10);

  const admin = await User.create({
    name: "Admin XKLD",
    email: "admin@xkld.local",
    passwordHash,
    role: "Admin",
    level: "Quan tri he thong",
  });

  const leader = await User.create({
    name: "Nguyen Minh Anh",
    email: "leader@xkld.local",
    passwordHash,
    role: "CTV",
    ctvCode: "CTV-001",
    level: "Truong nhom",
  });

  const ctv = await User.create({
    name: "Tran Duc Huy",
    email: "ctv@xkld.local",
    passwordHash,
    role: "CTV",
    ctvCode: "CTV-002",
    parent: leader._id,
    level: "CTV cap 1",
  });

  const customer = await Customer.create({
    name: "Bui Thi Hoa",
    phone: "0987654321",
    market: "Han Quoc",
    owner: ctv._id,
    status: "INTERVIEW_DONE",
  });

  await PointCode.create({
    code: "CODE-10",
    customer: customer._id,
    orderName: "Don hang Han Quoc",
    totalPoints: 10,
    directPoints: 9,
    uplinePoints: 1,
    createdBy: admin._id,
  });

  console.log("Seed completed");
  console.log("Admin: admin@xkld.local / 123456");
  console.log("CTV: ctv@xkld.local / 123456");

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

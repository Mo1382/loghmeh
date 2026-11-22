import mongoose from "mongoose";

import { connectDB } from "@/lib/db";

export async function withTransaction(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Transaction callback must be a function.");
  }

  await connectDB();

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(() => callback(session));
  } finally {
    await session.endSession();
  }
}

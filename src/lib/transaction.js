import mongoose from "mongoose";

export async function withTransaction(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Transaction callback must be a function.");
  }

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(() => callback(session));
  } finally {
    await session.endSession();
  }
}

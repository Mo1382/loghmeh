import mongoose from "mongoose";

export async function withTransaction(callback) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(() => callback(session));
  } finally {
    await session.endSession();
  }
}

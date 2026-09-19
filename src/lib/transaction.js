import mongoose from "mongoose";

/**
 * Execute operations inside a MongoDB transaction.
 *
 * The callback receives the MongoDB session and should
 * pass it to Repository methods that participate in the
 * transaction.
 */
export async function withTransaction(callback) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const result = await callback(session);

    await session.commitTransaction();

    return result;
  } catch (error) {
    await session.abortTransaction();

    throw error;
  } finally {
    await session.endSession();
  }
}

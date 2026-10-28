import { beforeEach, describe, expect, it, vi } from "vitest";

const { startSessionMock } = vi.hoisted(() => ({
  startSessionMock: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    startSession: startSessionMock,
  },
}));

import { withTransaction } from "./transaction.js";

let session;

beforeEach(() => {
  vi.resetAllMocks();

  session = {
    withTransaction: vi.fn(async (transactionCallback) =>
      transactionCallback()
    ),
    endSession: vi.fn().mockResolvedValue(undefined),
  };

  startSessionMock.mockResolvedValue(session);
});

describe("withTransaction", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "not a callback"],
    ["a number", 42],
    ["an object", {}],
  ])(
    "rejects %s as an invalid callback before starting a session",
    async (_label, callback) => {
      await expect(withTransaction(callback)).rejects.toMatchObject({
        name: "TypeError",
        message: "Transaction callback must be a function.",
      });

      expect(startSessionMock).not.toHaveBeenCalled();
    }
  );

  it("starts a session, passes it to the callback, and returns the callback result", async () => {
    const callbackResult = { updated: true };
    const callback = vi.fn().mockResolvedValue(callbackResult);

    await expect(withTransaction(callback)).resolves.toBe(callbackResult);

    expect(startSessionMock).toHaveBeenCalledOnce();
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(session.withTransaction).toHaveBeenCalledWith(expect.any(Function));
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(session);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("supports a synchronous callback result", async () => {
    const callbackResult = "completed";
    const callback = vi.fn(() => callbackResult);

    await expect(withTransaction(callback)).resolves.toBe(callbackResult);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(session);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("propagates a callback error and still ends the session", async () => {
    const callbackError = new Error("Callback failed");
    const callback = vi.fn().mockRejectedValue(callbackError);

    await expect(withTransaction(callback)).rejects.toBe(callbackError);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(session);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("propagates a session.withTransaction error and still ends the session", async () => {
    const transactionError = new Error("Transaction failed");
    const callback = vi.fn();

    session.withTransaction.mockRejectedValueOnce(transactionError);

    await expect(withTransaction(callback)).rejects.toBe(transactionError);

    expect(callback).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("propagates an endSession error after a successful transaction", async () => {
    const cleanupError = new Error("Session cleanup failed");
    const callback = vi.fn().mockResolvedValue("completed");

    session.endSession.mockRejectedValueOnce(cleanupError);

    await expect(withTransaction(callback)).rejects.toBe(cleanupError);

    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(session);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("propagates a session-start error without attempting transaction or cleanup", async () => {
    const startSessionError = new Error("Could not start session");
    const callback = vi.fn();

    startSessionMock.mockRejectedValueOnce(startSessionError);

    await expect(withTransaction(callback)).rejects.toBe(startSessionError);

    expect(startSessionMock).toHaveBeenCalledOnce();
    expect(callback).not.toHaveBeenCalled();
    expect(session.withTransaction).not.toHaveBeenCalled();
    expect(session.endSession).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import { applySession } from "@/lib/helpers/apply-session";

describe("applySession", () => {
  // When a session is provided, attach it to the query and return
  // the result produced by query.session().
  it("attaches the provided session and returns the resulting query", () => {
    const session = { id: "test-session" };
    const queryWithSession = { result: "query with session" };

    const query = {
      session: vi.fn().mockReturnValue(queryWithSession),
    };

    const result = applySession(query, session);

    expect(query.session).toHaveBeenCalledOnce();
    expect(query.session).toHaveBeenCalledWith(session);
    expect(result).toBe(queryWithSession);
  });

  // Falsy session values must leave the query unchanged and must not
  // call query.session().
  it.each([
    { description: "undefined", session: undefined },
    { description: "null", session: null },
    { description: "false", session: false },
    { description: "zero", session: 0 },
    { description: "an empty string", session: "" },
  ])(
    "returns the original query when the session is $description",
    ({ session }) => {
      const query = {
        session: vi.fn(),
      };

      const result = applySession(query, session);

      expect(result).toBe(query);
      expect(query.session).not.toHaveBeenCalled();
    }
  );
});

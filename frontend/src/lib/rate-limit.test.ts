import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("blocks requests above the limit and releases them after the window", () => {
    const take = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(take("a", 0).allowed).toBe(true);
    expect(take("a", 100).allowed).toBe(true);
    expect(take("a", 200)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(take("b", 200).allowed).toBe(true);
    expect(take("a", 1001).allowed).toBe(true);
  });
});

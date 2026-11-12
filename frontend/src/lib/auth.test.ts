import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "./auth";

describe("authentication configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a PostgreSQL connection string", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));

    expect(() => getAuth()).toThrow("DATABASE_URL must be set");
  });

  it("requires a strong Better Auth secret", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("BETTER_AUTH_SECRET", "too-short");

    expect(() => getAuth()).toThrow("BETTER_AUTH_SECRET must be set");
  });
});

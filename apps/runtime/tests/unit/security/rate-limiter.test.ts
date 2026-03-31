import { describe, expect, it } from "vitest";
import { RateLimiter } from "../../../src/security/rate-limiter.js";

describe("RateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 5 });
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("test-key");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("blocks requests after limit", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });
    limiter.check("test-key");
    limiter.check("test-key");
    const result = limiter.check("test-key");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys separately", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
    const result1 = limiter.check("key-1");
    const result2 = limiter.check("key-2");
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });

  it("provides reset timestamp", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
    const result = limiter.check("test-key");
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60000);
  });

  it("resets a key", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
    limiter.check("test-key");
    limiter.reset("test-key");
    const result = limiter.check("test-key");
    expect(result.allowed).toBe(true);
  });

  it("cleans up expired entries", () => {
    const limiter = new RateLimiter({ windowMs: 1, maxRequests: 1 });
    limiter.check("test-key");
    return new Promise<void>(resolve => {
      setTimeout(() => {
        limiter.cleanup();
        const result = limiter.check("test-key");
        expect(result.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });
});

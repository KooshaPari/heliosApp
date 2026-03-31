import { describe, expect, it } from "vitest";
import {
  sanitizeObject,
  sanitizeString,
  sanitizeTerminalInput,
  validateId,
  validateLaneId,
  validateSessionId,
  validateTerminalId,
  validateWorkspaceId,
} from "../../../src/security/input-sanitizer.js";

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("enforces max length", () => {
    expect(sanitizeString("hello world", 5)).toBe("hello");
  });

  it("escapes HTML entities", () => {
    expect(sanitizeString("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(sanitizeString("a & b")).toBe("a &amp; b");
  });

  it("escapes quotes", () => {
    expect(sanitizeString('say "hello"')).toBe("say &quot;hello&quot;");
  });
});

describe("sanitizeObject", () => {
  it("sanitizes all string fields", () => {
    const input = { name: "<b>test</b>", value: 123 };
    const result = sanitizeObject(input);
    expect(result.name).toBe("&lt;b&gt;test&lt;/b&gt;");
    expect(result.value).toBe(123);
  });

  it("respects field limits", () => {
    const input = { name: "a very long string that exceeds limit" };
    const result = sanitizeObject(input, { name: 10 });
    expect(result.name).toBe("a very lon");
  });

  it("handles nested objects", () => {
    const input = { nested: { value: "<script>" } };
    const result = sanitizeObject(input);
    expect((result.nested as Record<string, unknown>).value).toBe("&lt;script&gt;");
  });
});

describe("validateId", () => {
  it("rejects empty strings", () => {
    expect(validateId("")).toBe(false);
    expect(validateId("   ")).toBe(false);
  });

  it("rejects overly long IDs", () => {
    expect(validateId("a".repeat(101))).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(validateId("test<script>")).toBe(false);
    expect(validateId("test;rm -rf")).toBe(false);
  });

  it("accepts valid IDs", () => {
    expect(validateId("ws_abc123")).toBe(true);
    expect(validateId("lane-456")).toBe(true);
    expect(validateId("session_789")).toBe(true);
  });

  it("validates prefix when provided", () => {
    expect(validateId("ws_abc", "ws_")).toBe(true);
    expect(validateId("ln_abc", "ws_")).toBe(false);
  });
});

describe("validateWorkspaceId", () => {
  it("delegates to validateId", () => {
    expect(validateWorkspaceId("ws_valid")).toBe(true);
    expect(validateWorkspaceId("<script>")).toBe(false);
  });
});

describe("validateLaneId", () => {
  it("delegates to validateId", () => {
    expect(validateLaneId("ln_valid")).toBe(true);
    expect(validateLaneId("")).toBe(false);
  });
});

describe("validateSessionId", () => {
  it("delegates to validateId", () => {
    expect(validateSessionId("ss_valid")).toBe(true);
    expect(validateSessionId("")).toBe(false);
  });
});

describe("validateTerminalId", () => {
  it("delegates to validateId", () => {
    expect(validateTerminalId("tm_valid")).toBe(true);
    expect(validateTerminalId("")).toBe(false);
  });
});

describe("sanitizeTerminalInput", () => {
  it("sanitizes terminal input", () => {
    const input = "<script>alert('xss')</script>";
    const result = sanitizeTerminalInput(input);
    expect(result).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
  });

  it("enforces 10000 character limit", () => {
    const input = "a".repeat(15000);
    const result = sanitizeTerminalInput(input);
    expect(result.length).toBeLessThanOrEqual(10000);
  });
});

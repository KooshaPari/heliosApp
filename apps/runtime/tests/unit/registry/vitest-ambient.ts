declare module "vitest" {
  type TestHandler = () => void | Promise<void>;
  type SuiteHandler = () => void;

  interface Matcher {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toHaveLength(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toThrow(expected?: unknown): void;
  }

  interface RejectMatcher {
    toThrow(expected?: unknown): Promise<void>;
  }

  interface ExpectStatic {
    (actual: unknown): Matcher & {
      rejects: RejectMatcher;
      not: Matcher;
    };
  }

  export const describe: (name: string, handler: SuiteHandler) => void;
  export const it: (name: string, handler: TestHandler) => void;
  export const beforeEach: (handler: TestHandler) => void;
  export const afterEach: (handler: TestHandler) => void;
  export const expect: ExpectStatic;
}

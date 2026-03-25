/**
 * Type shim for test files that import from "vitest".
 * The project uses Bun's built-in test runner which provides these globals,
 * but some test files were written with vitest-style imports.
 */
declare module "vitest" {
  // Re-export bun's global test types
  // biome-ignore lint: this is a type shim
  export const describe: any;
  // biome-ignore lint: this is a type shim
  export const test: any;
  // biome-ignore lint: this is a type shim
  export const it: any;
  // biome-ignore lint: this is a type shim
  export const expect: any;
  // biome-ignore lint: this is a type shim
  export const beforeEach: any;
  // biome-ignore lint: this is a type shim
  export const afterEach: any;
  // biome-ignore lint: this is a type shim
  export const beforeAll: any;
  // biome-ignore lint: this is a type shim
  export const afterAll: any;
  // biome-ignore lint: this is a type shim
  export const vi: any;
}

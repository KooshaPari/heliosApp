<<<<<<< HEAD
const chrBackslash = "\\";

=======
>>>>>>> origin/main
/**
 * T012 - Build infrastructure validation tests.
 *
 * Validates the monorepo build configuration: workspace resolution,
 * tsconfig strict mode, config inheritance, and lint suppression checks.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../../..");

function readJson(relativePath: string): unknown {
  const fullPath = resolve(ROOT, relativePath);
<<<<<<< HEAD
  return JSON.parse((Bun as any).file(fullPath).text() as unknown as string);
=======
  return JSON.parse(Bun.file(fullPath).text() as unknown as string);
>>>>>>> origin/main
}

/**
 * Strip JSONC comments (block and line) without breaking strings.
 * Walks character-by-character to respect quoted regions.
 */
function stripJsonComments(input: string): string {
  let result = "";
  let i = 0;
  const len = input.length;
  while (i < len) {
    const ch = input[i];
    const next = input[i + 1];
    // String literal: copy verbatim until closing quote
    if (ch === '"') {
      let j = i + 1;
      while (j < len) {
<<<<<<< HEAD
        if (input[j] === chrBackslash) {
=======
        if (input[j] === "\\") {
>>>>>>> origin/main
          j += 2;
          continue;
        }
        if (input[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      result += input.slice(i, j);
      i = j;
      continue;
    }
    // Block comment
    if (ch === "/" && next === "*") {
      const end = input.indexOf("*/", i + 2);
      i = end === -1 ? len : end + 2;
      continue;
    }
    // Line comment
    if (ch === "/" && next === "/") {
      const end = input.indexOf("\n", i + 2);
      i = end === -1 ? len : end;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

async function readJsonAsync(relativePath: string): Promise<Record<string, unknown>> {
  const fullPath = resolve(ROOT, relativePath);
<<<<<<< HEAD
  const text = await (Bun as any).file(fullPath).text();
=======
  const text = await Bun.file(fullPath).text();
>>>>>>> origin/main
  return JSON.parse(stripJsonComments(text)) as Record<string, unknown>;
}

describe("workspace configuration", () => {
<<<<<<< HEAD
  test("root package.json declares project name and type", async () => {
    const pkg = await readJsonAsync("package.json");
    expect(pkg.name).toBe("heliosapp");
    expect(pkg.type).toBe("module");
  });

  test("bunfig.toml exists and contains install settings", async () => {
    const content = await (Bun as any).file(resolve(ROOT, "bunfig.toml")).text();
=======
  test("root package.json declares both workspace paths", async () => {
    const pkg = await readJsonAsync("package.json");
    const workspaces = pkg["workspaces"] as string[];
    expect(workspaces).toContain("apps/desktop");
    expect(workspaces).toContain("apps/runtime");
  });

  test("bunfig.toml exists and contains install settings", async () => {
    const content = await Bun.file(resolve(ROOT, "bunfig.toml")).text();
>>>>>>> origin/main
    expect(content).toContain("[install]");
    expect(content).toContain("exact = true");
  });

  test("bun.lock exists (deterministic lockfile)", () => {
    expect(existsSync(resolve(ROOT, "bun.lock"))).toBe(true);
  });
});

describe("tsconfig strict mode", () => {
  test("tsconfig.base.json has strict mode enabled", async () => {
    const config = await readJsonAsync("tsconfig.base.json");
<<<<<<< HEAD
    const opts = config.compilerOptions as Record<string, unknown>;
    expect(opts.strict).toBe(true);
=======
    const opts = config["compilerOptions"] as Record<string, unknown>;
    expect(opts["strict"]).toBe(true);
>>>>>>> origin/main
  });

  test("tsconfig.base.json has noUncheckedIndexedAccess", async () => {
    const config = await readJsonAsync("tsconfig.base.json");
<<<<<<< HEAD
    const opts = config.compilerOptions as Record<string, unknown>;
    expect(opts.noUncheckedIndexedAccess).toBe(true);
=======
    const opts = config["compilerOptions"] as Record<string, unknown>;
    expect(opts["noUncheckedIndexedAccess"]).toBe(true);
>>>>>>> origin/main
  });

  test("tsconfig.base.json has exactOptionalPropertyTypes", async () => {
    const config = await readJsonAsync("tsconfig.base.json");
<<<<<<< HEAD
    const opts = config.compilerOptions as Record<string, unknown>;
    expect(opts.exactOptionalPropertyTypes).toBe(true);
=======
    const opts = config["compilerOptions"] as Record<string, unknown>;
    expect(opts["exactOptionalPropertyTypes"]).toBe(true);
>>>>>>> origin/main
  });
});

describe("workspace tsconfig inheritance", () => {
  test("apps/runtime/tsconfig.json extends base", async () => {
    const config = await readJsonAsync("apps/runtime/tsconfig.json");
<<<<<<< HEAD
    expect(config.extends).toBe("../../tsconfig.base.json");
=======
    expect(config["extends"]).toBe("../../tsconfig.base.json");
>>>>>>> origin/main
  });

  test("apps/desktop/tsconfig.json extends base", async () => {
    const config = await readJsonAsync("apps/desktop/tsconfig.json");
<<<<<<< HEAD
    expect(config.extends).toBe("../../tsconfig.base.json");
=======
    expect(config["extends"]).toBe("../../tsconfig.base.json");
>>>>>>> origin/main
  });

  test("both workspace tsconfigs use composite mode", async () => {
    const runtime = await readJsonAsync("apps/runtime/tsconfig.json");
    const desktop = await readJsonAsync("apps/desktop/tsconfig.json");
<<<<<<< HEAD
    const rOpts = runtime.compilerOptions as Record<string, unknown>;
    const dOpts = desktop.compilerOptions as Record<string, unknown>;
    expect(rOpts.composite).toBe(true);
    expect(dOpts.composite).toBe(true);
=======
    const rOpts = runtime["compilerOptions"] as Record<string, unknown>;
    const dOpts = desktop["compilerOptions"] as Record<string, unknown>;
    expect(rOpts["composite"]).toBe(true);
    expect(dOpts["composite"]).toBe(true);
>>>>>>> origin/main
  });
});

describe("path alias configuration", () => {
  test("tsconfig.base.json declares @helios/runtime path alias", async () => {
    const config = await readJsonAsync("tsconfig.base.json");
<<<<<<< HEAD
    const opts = config.compilerOptions as Record<string, unknown>;
    const paths = opts.paths as Record<string, string[]>;
=======
    const opts = config["compilerOptions"] as Record<string, unknown>;
    const paths = opts["paths"] as Record<string, string[]>;
>>>>>>> origin/main
    expect(paths["@helios/runtime"]).toBeDefined();
    expect(paths["@helios/runtime/*"]).toBeDefined();
  });

  test("tsconfig.base.json declares @helios/desktop path alias", async () => {
    const config = await readJsonAsync("tsconfig.base.json");
<<<<<<< HEAD
    const opts = config.compilerOptions as Record<string, unknown>;
    const paths = opts.paths as Record<string, string[]>;
=======
    const opts = config["compilerOptions"] as Record<string, unknown>;
    const paths = opts["paths"] as Record<string, string[]>;
>>>>>>> origin/main
    expect(paths["@helios/desktop"]).toBeDefined();
    expect(paths["@helios/desktop/*"]).toBeDefined();
  });
});

describe("workspace dependency graph", () => {
  test("no circular workspace dependencies", async () => {
    const runtime = await readJsonAsync("apps/runtime/package.json");
    const desktop = await readJsonAsync("apps/desktop/package.json");

    const runtimeDeps = {
<<<<<<< HEAD
      ...(runtime.dependencies as Record<string, string> | undefined),
      ...(runtime.devDependencies as Record<string, string> | undefined),
    };
    const desktopDeps = {
      ...(desktop.dependencies as Record<string, string> | undefined),
      ...(desktop.devDependencies as Record<string, string> | undefined),
=======
      ...(runtime["dependencies"] as Record<string, string> | undefined),
      ...(runtime["devDependencies"] as Record<string, string> | undefined),
    };
    const desktopDeps = {
      ...(desktop["dependencies"] as Record<string, string> | undefined),
      ...(desktop["devDependencies"] as Record<string, string> | undefined),
>>>>>>> origin/main
    };

    // desktop depends on runtime, runtime must NOT depend on desktop
    expect(desktopDeps["@helios/runtime"]).toBeDefined();
    expect(runtimeDeps["@helios/desktop"]).toBeUndefined();
  });
});

describe("lint suppression directives", () => {
<<<<<<< HEAD
  test("no suppression directives in source files", async () => {
    const glob = new (Bun as any).Glob("**/*.ts");
=======
  test("no @ts-ignore or @ts-expect-error in source files", async () => {
    const glob = new Bun.Glob("**/*.ts");
>>>>>>> origin/main
    const suppressionPattern = /@ts-ignore|@ts-expect-error/;

    const srcDirs = [resolve(ROOT, "apps/runtime/src"), resolve(ROOT, "apps/desktop/src")];

    for (const dir of srcDirs) {
<<<<<<< HEAD
      if (!existsSync(dir)) {
        continue;
      }
      for await (const path of glob.scan({ cwd: dir, absolute: true })) {
        const content = await (Bun as any).file(path).text();
        const relativePath = path.replace(`${ROOT}/`, "");
=======
      if (!existsSync(dir)) continue;
      for await (const path of glob.scan({ cwd: dir, absolute: true })) {
        // Skip test files - they are allowed to have suppression directives
        if (path.includes("__tests__") || path.includes(".test.") || path.includes(".spec.")) {
          continue;
        }
        const content = await Bun.file(path).text();
        const relativePath = path.replace(ROOT + "/", "");
>>>>>>> origin/main
        expect(
          suppressionPattern.test(content),
          `Found suppression directive in ${relativePath}`
        ).toBe(false);
      }
    }
  });
});

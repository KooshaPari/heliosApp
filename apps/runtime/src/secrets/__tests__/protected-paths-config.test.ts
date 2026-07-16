import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProtectedPathConfig } from "../protected-paths-config.js";

describe("ProtectedPathConfig persistence boundaries", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "helios-protected-paths-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects broad patterns imported from disk", async () => {
    const path = join(tempDir, "patterns.json");
    writeFileSync(
      path,
      JSON.stringify([
        {
          id: "unsafe-all",
          pattern: "**/*",
          description: "everything",
          enabled: true,
          isDefault: false,
        },
      ])
    );

    const config = new ProtectedPathConfig();
    await expect(config.importPatterns(path)).rejects.toThrow("too broad");
    expect(config.listPatterns().some(pattern => pattern.id === "unsafe-all")).toBe(false);
  });

  it("rejects malformed values without partially applying earlier entries", async () => {
    const path = join(tempDir, "patterns.json");
    writeFileSync(
      path,
      JSON.stringify([
        {
          id: "valid-custom",
          pattern: "*.token",
          description: "token files",
          enabled: true,
          isDefault: false,
        },
        {
          id: "coerced-enabled",
          pattern: "*.key",
          description: "key files",
          enabled: "false",
          isDefault: false,
        },
      ])
    );

    const config = new ProtectedPathConfig();
    const before = config.listPatterns();
    await expect(config.importPatterns(path)).rejects.toThrow("enabled");
    expect(config.listPatterns()).toEqual(before);
  });

  it("exports through a complete JSON replacement with no temporary residue", async () => {
    const path = join(tempDir, "nested", "patterns.json");
    const config = new ProtectedPathConfig();
    config.addPattern("*.secret", "secret files");

    await config.exportPatterns(path);

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(config.listPatterns());
    const entries = new Bun.Glob("patterns.json.tmp-*").scanSync({ cwd: join(tempDir, "nested") });
    expect(Array.from(entries)).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryLocalBus } from "../../protocol/bus.js";
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

  it("rejects duplicate imported pattern IDs without changing state", async () => {
    const path = join(tempDir, "patterns.json");
    writeFileSync(
      path,
      JSON.stringify([
        {
          id: "duplicate-custom",
          pattern: "*.first",
          description: "first",
          enabled: true,
          isDefault: false,
        },
        {
          id: "duplicate-custom",
          pattern: "*.second",
          description: "second",
          enabled: true,
          isDefault: false,
        },
      ])
    );
    const config = new ProtectedPathConfig();
    const before = config.listPatterns();

    await expect(config.importPatterns(path)).rejects.toThrow("duplicate id 'duplicate-custom'");
    expect(config.listPatterns()).toEqual(before);
  });

  it("rejects imported redefinition of a default pattern", async () => {
    const path = join(tempDir, "patterns.json");
    writeFileSync(
      path,
      JSON.stringify([
        {
          id: "dotenv",
          pattern: "*.txt",
          description: "weakened default",
          enabled: false,
          isDefault: false,
        },
      ])
    );
    const config = new ProtectedPathConfig();
    const before = config.listPatterns();

    await expect(config.importPatterns(path)).rejects.toThrow("cannot redefine default 'dotenv'");
    expect(config.listPatterns()).toEqual(before);
  });

  it("exports through a complete JSON replacement with no temporary residue", async () => {
    const path = join(tempDir, "nested", "patterns.json");
    const config = new ProtectedPathConfig();
    await config.addPattern("*.secret", "secret files");

    await config.exportPatterns(path);

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(config.listPatterns());
    const entries = new Bun.Glob("patterns.json.tmp-*").scanSync({ cwd: join(tempDir, "nested") });
    expect(Array.from(entries)).toEqual([]);
  });
});

describe("ProtectedPathConfig audit lifecycle", () => {
  it("owns audit publication before committing a pattern change", async () => {
    const bus = new InMemoryLocalBus();
    let releasePublish: (() => void) | undefined;
    bus.publish = () =>
      new Promise<void>(resolve => {
        releasePublish = resolve;
      });
    const config = new ProtectedPathConfig({ bus });
    const before = config.listPatterns();

    const operation = config.addPattern("*.pending", "pending audit");
    const committedBeforeAudit = config.listPatterns();
    releasePublish?.();

    expect(operation).toBeInstanceOf(Promise);
    expect(committedBeforeAudit).toEqual(before);
    const pattern = await operation;
    expect(config.listPatterns()).toContainEqual(pattern);
  });

  it("preserves pattern state when audit publication fails", async () => {
    const bus = new InMemoryLocalBus();
    bus.publish = () => Promise.reject(new Error("audit unavailable"));
    const config = new ProtectedPathConfig({ bus });
    const before = config.listPatterns();

    await expect(config.addPattern("*.failed", "failed audit")).rejects.toThrow(
      "audit unavailable"
    );
    expect(config.listPatterns()).toEqual(before);
  });

  it("rejects a stale disable after a concurrent removal", async () => {
    const bus = new InMemoryLocalBus();
    const config = new ProtectedPathConfig({ bus });
    const pattern = await config.addPattern("*.concurrent", "concurrent removal");
    const publish = bus.publish.bind(bus);
    bus.publish = async envelope => {
      if (envelope.payload?.action === "disable") {
        await config.removePattern(pattern.id);
      }
      await publish(envelope);
    };

    await expect(config.disablePattern(pattern.id)).rejects.toThrow(
      "Pattern changed before disable"
    );
    expect(config.listPatterns()).not.toContainEqual(pattern);
  });

  it("rejects a stale enable after a concurrent removal", async () => {
    const bus = new InMemoryLocalBus();
    const config = new ProtectedPathConfig({ bus });
    const pattern = await config.addPattern("*.disabled", "concurrent removal");
    await config.disablePattern(pattern.id);
    const publish = bus.publish.bind(bus);
    bus.publish = async envelope => {
      if (envelope.payload?.action === "enable") {
        await config.removePattern(pattern.id);
      }
      await publish(envelope);
    };

    await expect(config.enablePattern(pattern.id)).rejects.toThrow("Pattern changed before enable");
    expect(config.listPatterns()).not.toContainEqual(pattern);
  });
});
